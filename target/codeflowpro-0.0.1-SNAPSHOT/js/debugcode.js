document.addEventListener('DOMContentLoaded', () => {
    const debugBtn = document.getElementById('debugBtn');
    const languageSelect = document.getElementById('languageSelect');
    const codeInputTextarea = document.getElementById('codeInput');
    const alertContainer = document.getElementById('alertContainer');
    const outputDisplay = document.getElementById('outputDisplay');
    const codeEditor = CodeMirror.fromTextArea(codeInputTextarea, {
        mode: 'text/x-java',
        theme: 'dracula',
        lineNumbers: true,
        tabSize: 2,
        viewportMargin: Infinity,
        lineWrapping: true,
        gutters: ['CodeMirror-linenumbers', 'breakpoints'],
        matchBrackets: true,
        autoCloseBrackets: true
    });
    let steps = [];
    let currentStep = -1;
    let callStack = [];
    let lineMarks = [];
    let breakpoints = new Set();
    let programOutput = '';
    let executionTime = 0;

    const defaultCodes = {
        JavaScript: `
function factorial(n) {
    if (n <= 1) return 1;
    let result = n * factorial(n - 1);
    return result;
}
let final = factorial(5);
console.log(final);
        `,
        Java: `
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
        `
    };

    codeEditor.setValue(defaultCodes[languageSelect.value]);
    languageSelect.addEventListener('change', () => {
        codeEditor.setValue(defaultCodes[languageSelect.value]);
        codeEditor.setOption('mode', languageSelect.value === 'Java' ? 'text/x-java' : 'javascript');
        reset();
    });

    codeEditor.on('gutterClick', (cm, n) => {
        const info = cm.lineInfo(n);
        if (info.gutterMarkers) {
            cm.setGutterMarker(n, 'breakpoints', null);
            breakpoints.delete(n + 1);
        } else {
            cm.setGutterMarker(n, 'breakpoints', makeMarker());
            breakpoints.add(n + 1);
        }
    });

    function makeMarker() {
        const marker = document.createElement('div');
        marker.style.color = '#ff5555';
        marker.innerHTML = '●';
        return marker;
    }

    let sketch = function(p) {
        let isReady = false;

        p.setup = function() {
            p.createCanvas(600, 500).parent('visualizer');
            p.background(40, 42, 54);
            p.textAlign(p.LEFT, p.TOP);
            p.textSize(14);
            isReady = true;
        };

        p.drawState = function() {
            if (!isReady || currentStep < 0 || currentStep >= steps.length) {
                p.background(40, 42, 54);
                p.fill(248, 248, 242);
                p.text('No execution steps. Click "Start Debugging" to begin.', 20, 20);
                p.text(`Execution Time: ${executionTime}ms`, 20, 40);
                return;
            }
            p.background(40, 42, 54);
            const step = steps[currentStep];
            p.fill(80, 250, 123);
            p.text(`Step ${currentStep + 1}/${steps.length} | Line: ${step.line} | ${step.type.toUpperCase()}`, 20, 20);
            p.text(`Execution Time: ${executionTime}ms`, 20, 40);

            // Call Stack
            p.fill(255, 184, 108);
            p.text('Call Stack:', 20, 70);
            let y = 90;
            for (let i = callStack.length - 1; i >= 0; i--) {
                p.fill(248, 248, 242);
                p.text(`${callStack[i].func} (Line ${callStack[i].line})`, 30, y);
                p.noFill();
                p.stroke(139, 233, 253);
                p.rect(25, y - 10, 550, 20, 5);
                y += 25;
            }

            // Variables
            p.noStroke();
            p.fill(189, 147, 249);
            p.text('Variables:', 20, y + 20);
            y += 40;
            const vars = step.variables || {};
            for (const [name, value] of Object.entries(vars)) {
                p.fill(248, 248, 242);
                p.text(`${name}: ${value}`, 30, y);
                y += 20;
            }
        };

        p.redrawState = function() {
            p.drawState();
            p.noLoop();
        };
    };

    const p5Instance = new p5(sketch);

    function showAlert(message, isError = true) {
        alertContainer.innerHTML = `<div class="alert" style="background: ${isError ? '#ff5555' : '#50fa7b'}">${message}</div>`;
        setTimeout(() => alertContainer.innerHTML = '', 5000);
    }

    function updateCodeHighlight() {
        lineMarks.forEach(mark => mark.clear());
        lineMarks = [];
        if (currentStep >= 0 && currentStep < steps.length) {
            const lineNumber = steps[currentStep].line - 1;
            if (lineNumber >= 0 && lineNumber < codeEditor.lineCount()) {
                const from = { line: lineNumber, ch: 0 };
                const to = { line: lineNumber, ch: codeEditor.getLine(lineNumber).length };
                const mark = codeEditor.markText(from, to, {
                    css: 'background-color: #6272a4; color: #f8f8f2; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
                });
                lineMarks.push(mark);
                codeEditor.scrollIntoView({ line: lineNumber, ch: 0 }, 200);
            }
        }
        outputDisplay.textContent = programOutput || 'No output yet.';
        p5Instance.redrawState();
    }

    function reset() {
        steps = [];
        currentStep = -1;
        callStack = [];
        lineMarks.forEach(mark => mark.clear());
        lineMarks = [];
        programOutput = '';
        executionTime = 0;
        outputDisplay.textContent = 'Program output will appear here...';
        p5Instance.redrawState();
    }

    debugBtn.addEventListener('click', async () => {
        const language = languageSelect.value;
        const code = codeEditor.getValue().trim();
        if (!code) {
            showAlert('Please enter code to debug.');
            return;
        }

        try {
            debugBtn.disabled = true;
            const response = await fetch('/codeflowpro/debug', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language, breakpoints: Array.from(breakpoints) })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Debugging failed');
            }

            const data = await response.json();
            if (data.status === 'success') {
                steps = data.steps || [];
                programOutput = data.output.replace(/\\n/g, '\n').replace(/\\u003d/g, '=');
                executionTime = data.executionTime;
                currentStep = -1;
                callStack = [];
                if (steps.length > 0) {
                    stepOver();
                    showAlert(`Debugging started with ${steps.length} steps.`, false);
                } else {
                    showAlert('No execution steps generated.');
                    outputDisplay.textContent = programOutput;
                }
            } else {
                throw new Error(data.error || 'Unknown error');
            }
        } catch (error) {
            showAlert(`Error: ${error.message}`);
            console.error('Debugging error:', error);
        } finally {
            debugBtn.disabled = false;
        }
    });

    function stepOver() {
        if (currentStep + 1 < steps.length) {
            currentStep++;
            updateCallStack(steps[currentStep]);
            updateCodeHighlight();
            if (steps[currentStep].breakpoint) showAlert(`Breakpoint hit at line ${steps[currentStep].line}`, false);
        }
    }

    function stepInto() {
        if (currentStep + 1 < steps.length) {
            const nextStep = steps[currentStep + 1];
            if (nextStep.type === 'call') stepOver();
            else stepOver();
        }
    }

    function stepOut() {
        while (currentStep + 1 < steps.length && steps[currentStep + 1].type !== 'return') {
            currentStep++;
            updateCallStack(steps[currentStep]);
        }
        if (currentStep + 1 < steps.length) stepOver();
    }

    function stepBackward() {
        if (currentStep > 0) {
            currentStep--;
            const prevStep = steps[currentStep + 1];
            if (prevStep.type === 'call') {
                callStack.pop();
            } else if (prevStep.type === 'return' && callStack.length > 0) {
                const funcStep = steps.slice(0, currentStep + 1).reverse().find(s => s.type === 'call' && s.line <= prevStep.line);
                if (funcStep) callStack.push({ func: funcStep.func || 'main', line: funcStep.line });
            }
            updateCodeHighlight();
        }
    }

    function updateCallStack(step) {
        if (step.type === 'call') {
            callStack.push({ func: step.func || 'main', line: step.line });
        } else if (step.type === 'return' && callStack.length > 0) {
            callStack.pop();
        }
    }

    document.getElementById('stepOver').addEventListener('click', stepOver);
    document.getElementById('stepInto').addEventListener('click', stepInto);
    document.getElementById('stepOut').addEventListener('click', stepOut);
    document.getElementById('stepBackward').addEventListener('click', stepBackward);
    document.getElementById('reset').addEventListener('click', reset);
});