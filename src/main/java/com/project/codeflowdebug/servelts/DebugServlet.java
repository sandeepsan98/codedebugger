package com.project.codeflowdebug.servelts;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@WebServlet("/debug")
public class DebugServlet extends HttpServlet {
    private static final Logger LOGGER = LoggerFactory.getLogger(DebugServlet.class);
    private static final Gson GSON = new Gson();
    private static final int TIMEOUT_SECONDS = 15;
    private static final Set<String> JAVA_KEYWORDS = new HashSet<>(Arrays.asList(
            "int", "if", "return", "public", "static", "class", "void", "for", "while", "else", "new", "this", "true", "false"
    ));

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setContentType("application/json; charset=UTF-8");

        StringBuilder jsonBuffer = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                jsonBuffer.append(line);
            }
        }

        JsonObject json;
        try {
            json = GSON.fromJson(jsonBuffer.toString(), JsonObject.class);
        } catch (Exception e) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Invalid JSON format");
            LOGGER.error("Invalid JSON received: {}", e.getMessage());
            return;
        }

        String code = json.get("code").getAsString();
        String language = json.get("language").getAsString();
        Set<Integer> breakpoints = new HashSet<>();
        if (json.has("breakpoints")) {
            for (JsonElement bp : json.get("breakpoints").getAsJsonArray()) {
                breakpoints.add(bp.getAsInt());
            }
        }

        if (code.trim().isEmpty()) {
            sendError(resp, HttpServletResponse.SC_BAD_REQUEST, "Code cannot be empty");
            return;
        }

        String output = "";
        JsonArray steps = new JsonArray();
        long executionTimeMs = 0;

        try {
            long startTime = System.nanoTime();
            switch (language) {
                case "JavaScript":
                    output = executeJavaScript(code, req, steps, breakpoints);
                    break;
                case "Java":
                    output = executeJava(code, steps, breakpoints);
                    break;
                default:
                    throw new IllegalStateException("Unsupported language: " + language);
            }
            executionTimeMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startTime);
        } catch (Exception e) {
            sendError(resp, HttpServletResponse.SC_INTERNAL_SERVER_ERROR, "Execution failed: " + e.getMessage());
            LOGGER.error("Execution error for {}: {}", language, e.getMessage(), e);
            return;
        }

        JsonObject response = new JsonObject();
        response.addProperty("output", sanitizeString(output));
        response.add("steps", steps);
        response.addProperty("executionTime", executionTimeMs);
        response.addProperty("status", "success");

        resp.getWriter().write(GSON.toJson(response));
    }

    private String executeJavaScript(String code, HttpServletRequest req, JsonArray steps, Set<Integer> breakpoints) throws IOException, InterruptedException {
        String scriptPath = req.getServletContext().getRealPath("/js/debug.js");
        File scriptFile = new File(scriptPath);
        if (!scriptFile.exists()) {
            throw new IOException("debug.js not found at: " + scriptPath);
        }

        ProcessBuilder pb = new ProcessBuilder("node", scriptPath, code);
        pb.redirectErrorStream(true);
        Process p = pb.start();
        if (!p.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            p.destroy();
            throw new IOException("JavaScript execution timeout exceeded");
        }

        String result;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            result = br.lines().collect(Collectors.joining("\n"));
        }

        if (result.contains("Execution error")) {
            throw new IOException("JavaScript execution error: " + result);
        }

        parseJavaScriptDebugOutput(result, steps, breakpoints);
        return filterOutput(result);
    }

    private String executeJava(String code, JsonArray steps, Set<Integer> breakpoints) throws IOException, InterruptedException {
        File tempDir = new File(System.getProperty("java.io.tmpdir"));
        File tempFile = new File(tempDir, "Temp.java");
        if (tempFile.exists()) tempFile.delete();

        String[] lines = code.split("\n");
        StringBuilder instrumentedCode = new StringBuilder();
        int lineNum = 0;
        int braceCount = 0;
        boolean inMethod = false;
        Map<Integer, Set<String>> scopeVars = new HashMap<>();
        Set<String> declaredVars = new HashSet<>();

        for (String line : lines) {
            lineNum++;
            String trimmed = line.trim();
            if (trimmed.contains("{")) braceCount += trimmed.chars().filter(ch -> ch == '{').count();
            if (trimmed.contains("}")) braceCount -= trimmed.chars().filter(ch -> ch == '}').count();

            Set<String> currentScope = scopeVars.computeIfAbsent(braceCount, k -> new HashSet<>());

            if (trimmed.startsWith("public class Temp")) {
                instrumentedCode.append(line).append("\n");
            } else if (trimmed.startsWith("public static") || trimmed.startsWith("static")) {
                inMethod = true;
                instrumentedCode.append(line).append("\n");
            } else if (inMethod && braceCount > 0 && !trimmed.isEmpty() && !trimmed.equals("}") && !trimmed.startsWith("System.out.println")) {
                instrumentedCode.append("    System.out.println(\"LINE:").append(lineNum).append("\");\n");

                // Add breakpoints
                if (breakpoints.contains(lineNum)) {
                    instrumentedCode.append("    System.out.println(\"BREAKPOINT:").append(lineNum).append("\");\n");
                }

                // Handle function calls
                Pattern callPattern = Pattern.compile("\\b(\\w+)\\s*\\(");
                Matcher callMatcher = callPattern.matcher(trimmed);
                if (callMatcher.find()) {
                    instrumentedCode.append("    System.out.println(\"CALL:").append(callMatcher.group(1)).append("\");\n");
                }

                // Handle control flow statements (return, break, continue)
                boolean isControlFlow = trimmed.contains("return") || trimmed.contains("break") || trimmed.contains("continue");
                if (isControlFlow && trimmed.contains("return")) {
                    // Update scope before logging for return statements
                    updateScopeVars(trimmed, currentScope, declaredVars);
                    Set<String> varsToLog = new HashSet<>(currentScope);
                    varsToLog.retainAll(declaredVars);
                    String varNames = String.join(", ", varsToLog.stream().map(v -> "\"" + v + "\"").toArray(String[]::new));
                    String varValues = String.join(", ", varsToLog.toArray(String[]::new));
                    if (!varNames.isEmpty() && !varValues.isEmpty()) {
                        instrumentedCode.append("    logVariables(new String[] {").append(varNames).append("}, new Object[] {").append(varValues).append("}, ").append(lineNum).append(");\n");
                    }
                    instrumentedCode.append("    System.out.println(\"RETURN\");\n");
                }

                // Append the original line
                instrumentedCode.append("    ").append(line).append("\n");

                // Log variables after the line, but only for non-control-flow statements
                if (!isControlFlow) {
                    updateScopeVars(trimmed, currentScope, declaredVars);
                    Set<String> varsToLog = new HashSet<>(currentScope);
                    varsToLog.retainAll(declaredVars);
                    String varNames = String.join(", ", varsToLog.stream().map(v -> "\"" + v + "\"").toArray(String[]::new));
                    String varValues = String.join(", ", varsToLog.toArray(String[]::new));
                    if (!varNames.isEmpty() && !varValues.isEmpty()) {
                        instrumentedCode.append("    logVariables(new String[] {").append(varNames).append("}, new Object[] {").append(varValues).append("}, ").append(lineNum).append(");\n");
                    }
                }
            } else {
                instrumentedCode.append(line).append("\n");
            }

            if (inMethod && braceCount == 0 && trimmed.equals("}")) inMethod = false;
            if (trimmed.equals("}")) scopeVars.remove(braceCount + 1);
        }

        String logMethods = """
            public static void logVariables(String[] names, Object[] values, int line) {
                if (names.length != values.length) return;
                StringBuilder sb = new StringBuilder("VARS:");
                for (int i = 0; i < names.length; i++) {
                    if (i > 0) sb.append(",");
                    String valueStr = values[i] != null ? values[i].toString().replace("\\"", "\\\\\\"").replace("\\n", " ") : "null";
                    sb.append(names[i]).append("=").append(valueStr);
                }
                System.out.println(sb.toString() + ":LINE:" + line);
            }
        """;
        instrumentedCode.insert(instrumentedCode.lastIndexOf("}"), logMethods);

        Files.writeString(tempFile.toPath(), instrumentedCode.toString());

        ProcessBuilder pb = new ProcessBuilder("javac", tempFile.getAbsolutePath());
        pb.redirectErrorStream(true);
        Process compileProcess = pb.start();
        if (!compileProcess.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            compileProcess.destroy();
            tempFile.delete();
            throw new IOException("Java compilation timeout exceeded");
        }
        String compileOutput = new BufferedReader(new InputStreamReader(compileProcess.getInputStream()))
                .lines().collect(Collectors.joining("\n"));
        if (compileProcess.exitValue() != 0) {
            tempFile.delete();
            throw new IOException("Compilation error: " + compileOutput);
        }

        pb = new ProcessBuilder("java", "-cp", tempDir.getAbsolutePath(), "Temp");
        pb.redirectErrorStream(true);
        Process runProcess = pb.start();
        if (!runProcess.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
            runProcess.destroy();
            tempFile.delete();
            throw new IOException("Java execution timeout exceeded");
        }
        String output;
        try (BufferedReader br = new BufferedReader(new InputStreamReader(runProcess.getInputStream()))) {
            output = br.lines().collect(Collectors.joining("\n"));
        }
        tempFile.delete();

        parseJavaDebugOutput(output, steps, breakpoints);
        return filterOutput(output);
    }

    private void updateScopeVars(String line, Set<String> scopeVars, Set<String> declaredVars) {
        // Detect variable declarations
        Pattern varDeclPattern = Pattern.compile("\\b(?:int|double|float|String)\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\b");
        Matcher declMatcher = varDeclPattern.matcher(line);
        while (declMatcher.find()) {
            String var = declMatcher.group(1);
            if (!JAVA_KEYWORDS.contains(var)) {
                scopeVars.add(var);
                declaredVars.add(var);
            }
        }
        // Detect assignments to existing variables
        Pattern varAssignPattern = Pattern.compile("\\b([a-zA-Z_][a-zA-Z0-9_]*)\\s*=\\s*[^;]");
        Matcher assignMatcher = varAssignPattern.matcher(line);
        while (assignMatcher.find()) {
            String var = assignMatcher.group(1);
            if (!JAVA_KEYWORDS.contains(var)) {
                scopeVars.add(var);
            }
        }
    }

    private void parseJavaDebugOutput(String output, JsonArray steps, Set<Integer> breakpoints) {
        String[] lines = output.split("\n");
        JsonObject currentStep = null;
        for (String line : lines) {
            if (line.startsWith("LINE:")) {
                currentStep = new JsonObject();
                currentStep.addProperty("line", Integer.parseInt(line.substring(5)));
                currentStep.addProperty("type", "line");
                if (breakpoints.contains(currentStep.get("line").getAsInt())) {
                    currentStep.addProperty("breakpoint", true);
                }
                steps.add(currentStep);
            } else if (line.startsWith("CALL:") && currentStep != null) {
                currentStep.addProperty("type", "call");
                currentStep.addProperty("func", line.substring(5));
            } else if (line.startsWith("RETURN") && currentStep != null) {
                currentStep.addProperty("type", "return");
            } else if (line.startsWith("VARS:") && currentStep != null) {
                String varsStr = line.contains(":LINE:") ? line.split(":LINE:")[0].substring(5) : "";
                JsonObject vars = new JsonObject();
                if (!varsStr.isEmpty()) {
                    String[] varPairs = varsStr.split(",");
                    for (String pair : varPairs) {
                        if (pair.contains("=")) {
                            String[] kv = pair.split("=", 2);
                            vars.addProperty(kv[0], kv.length > 1 ? kv[1] : "undefined");
                        }
                    }
                }
                currentStep.add("variables", vars);
            }
        }
    }

    private void parseJavaScriptDebugOutput(String output, JsonArray steps, Set<Integer> breakpoints) {
        String[] lines = output.split("\n");
        for (String line : lines) {
            if (line.startsWith("DEBUG:")) {
                String jsonStr = line.substring(6);
                try {
                    JsonObject debugState = GSON.fromJson(jsonStr, JsonObject.class);
                    for (JsonElement step : debugState.get("steps").getAsJsonArray()) {
                        JsonObject stepObj = step.getAsJsonObject();
                        if (breakpoints.contains(stepObj.get("line").getAsInt())) {
                            stepObj.addProperty("breakpoint", true);
                        }
                        steps.add(stepObj);
                    }
                } catch (Exception e) {
                    LOGGER.error("Failed to parse JS debug output: {}", e.getMessage());
                }
            }
        }
    }

    private String filterOutput(String output) {
        return Arrays.stream(output.split("\n"))
                .filter(line -> !line.startsWith("LINE:") &&
                        !line.startsWith("CALL:") &&
                        !line.startsWith("RETURN") &&
                        !line.startsWith("VARS:") &&
                        !line.startsWith("DEBUG:") &&
                        !line.startsWith("BREAKPOINT:") &&
                        !line.startsWith("NOTE: Picked up JDK_JAVA_OPTIONS"))
                .collect(Collectors.joining("\n"));
    }

    private String sanitizeString(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    private void sendError(HttpServletResponse resp, int status, String message) throws IOException {
        resp.setStatus(status);
        JsonObject errorResponse = new JsonObject();
        errorResponse.addProperty("error", message);
        errorResponse.addProperty("status", "error");
        resp.getWriter().write(GSON.toJson(errorResponse));
    }
}