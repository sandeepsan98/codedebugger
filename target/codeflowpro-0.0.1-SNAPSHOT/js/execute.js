// src/main/webapp/js/execute.js
const code = process.argv[2];

console.log("DEBUG: Starting execution with code:", code);

try {
    let arrayName = 'arr'; // Default
    const arrayMatch = code.match(/let\s+(\w+)\s*=\s*\[.*?\];/);
    if (arrayMatch) arrayName = arrayMatch[1];

    let algorithmType = 'Unknown';
    if (code.includes('partition') && code.includes('quickSort')) {
        algorithmType = 'Quick Sort';
    } else if (code.includes('while') && code.includes('key') && !code.includes('partition')) {
        algorithmType = 'Insertion Sort';
    } else if (code.includes('merge') && !code.includes('partition') && !code.includes('heapify')) {
        algorithmType = 'Merge Sort';
    } else if (code.includes('heapify') && !code.includes('partition')) {
        algorithmType = 'Heap Sort';
    } else if (code.includes('length - i - 1')) {
        algorithmType = 'Bubble Sort';
    } else if (code.includes('minIdx')) {
        algorithmType = 'Selection Sort';
    }
    console.log("DEBUG: Detected algorithm:", algorithmType);

    const lines = code.split('\n');
    let instrumentedCode = '';
    let lineNumber = 0;
    let inFunction = false;

    for (let line of lines) {
        lineNumber++;
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('function')) inFunction = true;
        if (trimmedLine === '}') inFunction = false;

        instrumentedCode += line + '\n';

        // Add line logging unless it's already a console.log
        if (trimmedLine && !trimmedLine.startsWith('console.log') && !trimmedLine.startsWith('//')) {
            instrumentedCode += `console.log("LINE:${lineNumber}");\n`;
        }

        // Log state on array modifications
        if (trimmedLine.match(/\w+\[\s*[^\]]+\s*\]\s*=\s*[^;]+;/) && !trimmedLine.includes('console.log')) {
            if (algorithmType === 'Quick Sort' && inFunction) {
                if (trimmedLine.includes('arr[i] = arr[j]') || trimmedLine.includes('arr[i + 1] = arr[high]')) {
                    instrumentedCode += `logState(${arrayName}, ${lineNumber});\n`;
                }
            } else if (algorithmType === 'Merge Sort' && inFunction) {
                if (trimmedLine.includes('arr[k] =')) {
                    instrumentedCode += `logState(${arrayName}, ${lineNumber});\n`;
                }
            } else if (algorithmType === 'Heap Sort' && inFunction) {
                if (trimmedLine.includes('arr[i] = arr[largest]') || trimmedLine.includes('arr[0] = arr[i]')) {
                    instrumentedCode += `logState(${arrayName}, ${lineNumber});\n`;
                }
            } else {
                instrumentedCode += `logState(${arrayName}, ${lineNumber});\n`;
            }
        }

        // Log initial state
        if (trimmedLine.match(/let\s+\w+\s*=\s*\[.*\];/)) {
            instrumentedCode += `logState(${arrayName}, ${lineNumber}); // Initial state\n`;
        }
    }

    console.log("DEBUG: Instrumented code:", instrumentedCode);

    const wrappedCode = `
        function logState(arr, line) {
            if (Array.isArray(arr)) {
                console.log("STATE:" + JSON.stringify(arr) + ":LINE:" + line);
            }
        }
        try {
            ${instrumentedCode}
            console.log("ALGORITHM_TYPE:" + "${algorithmType}");
            return ${arrayName};
        } catch (e) {
            console.error("Execution error:", e.message);
            throw e;
        }
    `;

    const func = new Function(wrappedCode);
    const result = func();
    console.log("DEBUG: Result:", result);
    if (result && Array.isArray(result)) {
        console.log(JSON.stringify(result));
    } else {
        console.log("No valid array output");
    }
} catch (error) {
    console.error('Error:', error.message);
}