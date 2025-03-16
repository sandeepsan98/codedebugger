# CodeFlow Debugger

![CodeFlow Debugger](https://via.placeholder.com/800x400.png?text=CodeFlow+Debugger+Screenshot)  
*(Replace with an actual screenshot or demo GIF of your app)*

**CodeFlow Debugger** is an interactive web-based tool designed to help developers debug and visualize the execution flow of their Java and JavaScript code. It provides step-by-step execution, breakpoint support, variable tracking, call stack visualization, and real-time output display, making it an invaluable tool for learning, teaching, and debugging.

---

## Features

- **Multi-Language Support**: Debug Java and JavaScript code seamlessly.
- **Step-by-Step Debugging**: Step over, step into, step out, and step backward through code execution.
- **Breakpoints**: Set breakpoints in the code editor to pause execution at specific lines.
- **Variable Tracking**: Monitor variable values at each execution step.
- **Call Stack Visualization**: View the call stack dynamically as functions are called and returned.
- **Real-Time Output**: See program output as it executes.
- **Interactive Visualizer**: Visualize execution flow using p5.js graphics.
- **Code Editor**: Powered by CodeMirror with syntax highlighting, line numbers, and breakpoint gutters.
- **Execution Time**: Measure the time taken for code execution.

---

## Technologies Used

### Backend
- **Java**: Servlet-based backend using `HttpServlet` for handling requests.
- **Gson**: JSON parsing and serialization for API responses.
- **SLF4J**: Logging framework for debugging and error tracking.
- **ProcessBuilder**: Executes Java and JavaScript code in isolated processes.
- **Node.js**: Executes JavaScript code with custom instrumentation.

### Frontend
- **HTML/CSS/JavaScript**: Core web technologies for the user interface.
- **CodeMirror**: Code editor with syntax highlighting and breakpoint support.
- **p5.js**: Visualization library for rendering the execution flow and call stack.
- **Dracula Theme**: Dark theme for the editor and UI for better readability.

### Development Tools
- **Servlet Container**: Deployed on a server like Apache Tomcat.
- **Maven**: Dependency management (assumed based on typical Java projects).
- **Git**: Version control.

---

## APIs Used

### Internal API
- **`/codeflowdebug/debug` (POST)**  
  - **Description**: Submits code for debugging and returns execution steps, output, and metadata.
  - **Request Body**:
    ```json
    {
      "code": "String (the code to debug)",
      "language": "String (Java or JavaScript)",
      "breakpoints": "Array of integers (line numbers)"
    }
    ```
  - **Response**:
    ```json
    {
      "output": "String (program output)",
      "steps": "Array (execution steps with line, type, variables, etc.)",
      "executionTime": "Long (time in milliseconds)",
      "status": "String (success or error)",
      "error": "String (optional error message)"
    }
    ```
  - **Content-Type**: `application/json`

### External Libraries
- **CodeMirror**: Loaded via CDN for the code editor.
- **p5.js**: Loaded via CDN for visualizations.

---

## Prerequisites

- **Java Development Kit (JDK)**: Version 17 .
- **Node.js**: For JavaScript execution (version 14+ recommended).
- **Servlet Container**: Apache Tomcat or equivalent.
- **Maven**: For building the Java backend (if applicable).
- **Web Browser**: Modern browser (Chrome, Firefox, Edge, etc.).

---

## Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/yourusername/codeflow-debugger.git
   cd codeflow-debugger
   ```

2. **Backend Setup**:
   - Ensure JDK and Maven are installed.
   - Place the `DebugServlet.java` file in `src/main/java/com/project/codeflowdebug/servelts/`.
   - Add dependencies to `pom.xml` (example below):
     ```xml
     <dependencies>
         <dependency>
             <groupId>com.google.code.gson</groupId>
             <artifactId>gson</artifactId>
             <version>2.10.1</version>
         </dependency>
         <dependency>
             <groupId>org.slf4j</groupId>
             <artifactId>slf4j-api</artifactId>
             <version>2.0.13</version>
         </dependency>
         <dependency>
             <groupId>org.slf4j</groupId>
             <artifactId>slf4j-simple</artifactId>
             <version>2.0.13</version>
         </dependency>
         <dependency>
             <groupId>javax.servlet</groupId>
             <artifactId>javax.servlet-api</artifactId>
             <version>4.0.1</version>
             <scope>provided</scope>
         </dependency>
     </dependencies>
     ```
   - Build the project:
     ```bash
     mvn clean package
     ```
   - Deploy the WAR file to your servlet container (e.g., Tomcat).

3. **Frontend Setup**:
   - Place the HTML (`index.html`) and JavaScript (`debugcode.js`) files in the web root directory (e.g., `webapp/`).
   - Ensure the `js/debug.js` Node.js script is in the `webapp/js/` directory.

4. **Run the Application**:
   - Start your servlet container (e.g., `startup.sh` for Tomcat).
   - Access the app at `http://localhost:8080/codeflowdebug/`.

---

## How to Use

1. **Select Language**:
   - Choose "JavaScript" or "Java" from the dropdown menu.

2. **Write or Paste Code**:
   - Enter your code in the CodeMirror editor. Default examples are provided for both languages.

3. **Set Breakpoints**:
   - Click the gutter next to a line number to add/remove a breakpoint (marked with a red dot).

4. **Start Debugging**:
   - Click "Start Debugging" to send the code to the backend for execution.

5. **Navigate Execution**:
   - **Step Over**: Move to the next line of execution.
   - **Step Into**: Dive into function calls (if applicable).
   - **Step Out**: Exit the current function and return to the caller.
   - **Step Backward**: Move to the previous step.
   - **Reset**: Clear the current debug session.

6. **View Results**:
   - **Visualizer**: See the call stack and variables in the p5.js canvas.
   - **Output**: Check the program output in the bottom panel.
   - **Alerts**: Notifications appear for breakpoints or errors.

---

## Application Flow

1. **User Input**:
   - The user selects a language, writes code, and optionally sets breakpoints in the CodeMirror editor.

2. **Debug Request**:
   - Clicking "Start Debugging" sends a POST request to `/codeflowdebug/debug` with the code, language, and breakpoints.

3. **Backend Processing**:
   - **JavaScript**: The `DebugServlet` executes the code via Node.js with `debug.js`, which instruments the code to log steps.
   - **Java**: The servlet instruments the code with logging statements, compiles it with `javac`, and runs it with `java`.
   - Execution steps, variables, and output are collected and sanitized.

4. **Response**:
   - The backend returns a JSON response with steps, output, and execution time.

5. **Frontend Rendering**:
   - The frontend parses the response, updates the visualizer (p5.js), highlights the current line in CodeMirror, and displays the output.

6. **Debugging Interaction**:
   - The user navigates through steps using the debug controls, with the UI updating dynamically.

---

## Example Usage

### JavaScript
```javascript
function factorial(n) {
    if (n <= 1) return 1;
    let result = n * factorial(n - 1);
    return result;
}
let final = factorial(5);
console.log(final);
```
- Set a breakpoint at `let result = n * factorial(n - 1);`.
- Click "Start Debugging" and step through to see the recursive calls and variable `result` updates.

### Java
```java
public class Temp {
    public static void main(String[] args) {
        int result = factorial(5);
        System.out.println(result);
    }
    static int factorial(int n) {
        if (n <= 1) return 1;
        int result = n * factorial(n - 1);
        return result;
    }
}
```
- Add a breakpoint at `int result = n * factorial(n - 1);`.
- Debug to observe the call stack grow and shrink with each recursive call.

---

## Limitations

- **Timeout**: Execution is limited to 15 seconds to prevent infinite loops.
- **Language Support**: Currently supports only Java and JavaScript.
- **Variable Serialization**: JavaScript variables that cannot be JSON-serialized are marked as "unserializable."
- **Scope**: Limited variable tracking in complex JavaScript closures.

---



Happy Debugging with CodeFlow Debugger! 🚀

---

