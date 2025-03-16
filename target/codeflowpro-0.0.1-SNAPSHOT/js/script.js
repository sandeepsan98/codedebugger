document.addEventListener('DOMContentLoaded', () => {
    const visualizeBtn = document.getElementById('visualizeBtn');
    const outputResult = document.getElementById('outputResult');
    const executionTime = document.getElementById('executionTime');
    const algorithmSelect = document.getElementById('algorithmSelect');
    const languageSelect = document.getElementById('languageSelect');
    const codeInputTextarea = document.getElementById('codeInput');
    const alertContainer = document.getElementById('alertContainer');
    const soundToggle = document.getElementById('soundToggle');
    const codeEditor = CodeMirror.fromTextArea(codeInputTextarea, {
        mode: 'text/x-java',
        theme: 'monokai',
        lineNumbers: true,
        readOnly: true,
        tabSize: 2,
        viewportMargin: Infinity,
        lineWrapping: true
    });
    let steps = [];
    let isAnimating = false;
    let algorithmName = 'Unknown';
    let currentStep = 0;
    let lineMarks = [];
    const DEFAULT_INPUT = '64, 34, 25, 12, 22, 11, 90';
    let currentArray = [];
    let audioContext;

    let sketch = function(p) {
        let barWidth = 40;
        let animationSpeed = 1000;
        let hoveredBarIndex = -1;
        let previousHeights = [];
        let previousPositions = [];
        let transitionProgress = 0;
        let comparisons = 0;
        let swaps = 0;
        let isReady = false;

        p.setup = function() {
            let canvas = p.createCanvas(600, 500).parent('visualizer');
            p.background(240);
            p.textAlign(p.CENTER, p.CENTER);
            p.textSize(14);
            adjustCanvas();
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            if (audioContext.state === 'suspended') {
                document.addEventListener('click', () => audioContext.resume().then(() => console.log('AudioContext resumed')), { once: true });
            }
            isReady = true;
        };

        function adjustCanvas() {
            let inputSize = currentArray.length > 0 ? currentArray.length : 7;
            barWidth = 40; // Fixed minimum bar width
            let newWidth = inputSize * barWidth + 20; // Canvas grows with input size
            p.resizeCanvas(Math.max(600, newWidth), 500); // Minimum width 600px
        }

        p.drawBars = function() {
            if (!isReady) return;
            p.background(240);
            if (steps.length === 0 || !currentArray.length) {
                p.text('No steps to visualize', p.width / 2, p.height / 2);
                return;
            }
            let step = steps[currentStep];
            if (step.array) {
                currentArray = step.array.map(val => val.toString());
            } else if (currentStep === 0) {
                currentArray = DEFAULT_INPUT.split(',').map(s => s.trim());
            }
            adjustCanvas();

            const isDataNumeric = currentArray.every(val => !isNaN(Number(val)) && val !== '');
            let maxValue = isDataNumeric
                ? Math.max(...currentArray.map(val => Number(val)))
                : Math.max(...currentArray.map(val => String(val).charCodeAt(0)));
            if (isNaN(maxValue) || maxValue === 0) maxValue = 1;

            if (previousHeights.length === 0 || transitionProgress === 0) {
                previousHeights = currentArray.map(val =>
                    (isDataNumeric ? Number(val) : String(val).charCodeAt(0)) / maxValue * (p.height - 100));
                previousPositions = currentArray.map((val, idx) => idx);
            }

            let targetHeights = currentArray.map(val =>
                (isDataNumeric ? Number(val) : String(val).charCodeAt(0)) / maxValue * (p.height - 100));

            if (currentStep === 0 && transitionProgress === 0) {
                swaps = 0;
                comparisons = 0;
            }

            if (currentStep > 0 && transitionProgress === 0 && steps[currentStep - 1].array) {
                let prevArray = steps[currentStep - 1].array.map(val => val.toString());
                let currPositions = currentArray.map((val, idx) => {
                    let prevIdx = prevArray.indexOf(val);
                    return prevIdx !== -1 ? prevIdx : idx;
                });

                for (let i = 0; i < currPositions.length; i++) {
                    if (currPositions[i] !== previousPositions[i]) {
                        swaps++;
                        console.log(`Bar swap detected at index ${i}: Position ${previousPositions[i]} -> ${currPositions[i]}, Swaps: ${swaps}`);
                        if (soundToggle.checked) {
                            playSound(targetHeights[i] || 400);
                        }
                    }
                }
                previousPositions = currPositions.slice();
            }

            for (let i = 0; i < currentArray.length; i++) {
                let value = currentArray[i];
                let barHeight = p.lerp(previousHeights[i] || 10, targetHeights[i], transitionProgress);
                if (isNaN(barHeight) || barHeight < 10) barHeight = 10;

                let heightRatio = barHeight / (p.height - 100);
                let r = p.lerp(100, 160, heightRatio);
                let g = p.lerp(150, 32, heightRatio);
                let b = p.lerp(255, 240, heightRatio);

                let isSwapped = currentStep > 0 && steps[currentStep - 1].array && previousPositions[i] !== i;
                p.fill(isSwapped ? [255, 100, 100] : currentStep === steps.length - 1 ? [100, 255, 100] : [r, g, b]);

                let xPos = i * barWidth + 10;
                p.rect(xPos, p.height - barHeight - 20, barWidth - 5, barHeight);

                p.fill(0);
                p.text(value, xPos + barWidth / 2, p.height - barHeight - 30);

                if (i === hoveredBarIndex) {
                    p.noFill();
                    p.stroke(255, 0, 0);
                    p.strokeWeight(2);
                    p.rect(xPos, p.height - barHeight - 20, barWidth - 5, barHeight);
                    p.noStroke();
                    p.fill(255, 255, 0, 200);
                    p.rect(xPos, p.height - barHeight - 60, barWidth, 20);
                    p.fill(0);
                    p.text(value, xPos + barWidth / 2, p.height - barHeight - 50);
                }
            }

            if (currentStep > 0 && steps[currentStep - 1].array) {
                let prevArray = steps[currentStep - 1].array.map(val => val.toString());
                for (let i = 0; i < prevArray.length - 1; i++) {
                    let currComp = isDataNumeric
                        ? Number(prevArray[i]) > Number(prevArray[i + 1])
                        : prevArray[i] > prevArray[i + 1];
                    if (currComp && transitionProgress === 0) {
                        comparisons++;
                    }
                }
            }

            p.fill(0);
            p.text(`Step: ${currentStep + 1}/${steps.length} | ${algorithmName}`, p.width / 2, 20);
            p.text(`Comparisons: ${comparisons} | Swaps: ${swaps}`, p.width / 2, 40);
            updateCodeHighlight();
        };

        function playSound(height) {
            if (!soundToggle.checked || !audioContext) return;
            if (audioContext.state === 'suspended') {
                audioContext.resume().then(() => console.log('AudioContext resumed in playSound'));
            }
            let oscillator = audioContext.createOscillator();
            let gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            let frequency = p.map(height, 10, p.height - 100, 200, 800);
            if (isNaN(frequency) || frequency < 200 || frequency > 800) frequency = 400;
            oscillator.frequency.value = frequency;
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.2);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.2);
            console.log(`Sound played at ${frequency}Hz`);
        }

        p.mouseMoved = function() {
            let newHoveredBarIndex = -1;
            if (currentArray.length > 0) {
                const isDataNumeric = currentArray.every(val => !isNaN(Number(val)) && val !== '');
                let maxValue = isDataNumeric
                    ? Math.max(...currentArray.map(val => Number(val)))
                    : Math.max(...currentArray.map(val => String(val).charCodeAt(0)));
                for (let i = 0; i < currentArray.length; i++) {
                    let xPos = i * barWidth + 10;
                    let barHeight = (isDataNumeric ? Number(currentArray[i]) : String(currentArray[i]).charCodeAt(0)) / maxValue * (p.height - 100);
                    if (barHeight < 10) barHeight = 10;
                    if (p.mouseX >= xPos && p.mouseX <= xPos + barWidth - 5 &&
                        p.mouseY >= p.height - barHeight - 20 && p.mouseY <= p.height - 20) {
                        newHoveredBarIndex = i;
                        break;
                    }
                }
            }
            if (newHoveredBarIndex !== hoveredBarIndex) {
                hoveredBarIndex = newHoveredBarIndex;
                p.redraw();
            }
        };

        p.startAnimation = function() {
            if (!isAnimating && steps.length > 0) {
                isAnimating = true;
                transitionProgress = 0;
                comparisons = 0;
                swaps = 0;
                animate();
            }
        };

        p.stopAnimation = function() {
            isAnimating = false;
        };

        p.setSpeed = function(speed) {
            animationSpeed = speed;
        };

        p.setStep = function(step) {
            let prevStep = currentStep;
            currentStep = Math.max(0, Math.min(step, steps.length - 1));
            transitionProgress = 1;

            if (steps[currentStep].array) {
                let prevArray = steps[prevStep].array ? steps[prevStep].array.map(val => val.toString()) : currentArray;
                currentArray = steps[currentStep].array.map(val => val.toString());
                previousHeights = currentArray.map(val =>
                    (currentArray.every(v => !isNaN(Number(v)) && v !== '') ? Number(val) : String(val).charCodeAt(0)) /
                    Math.max(...currentArray.map(v => currentArray.every(v => !isNaN(Number(v)) && v !== '') ? Number(v) : String(v).charCodeAt(0))) * (p.height - 100));
                let targetHeights = previousHeights.slice();

                let currPositions = currentArray.map((val, idx) => {
                    let prevIdx = prevArray.indexOf(val);
                    return prevIdx !== -1 ? prevIdx : idx;
                });

                for (let i = 0; i < currPositions.length; i++) {
                    if (currPositions[i] !== previousPositions[i]) {
                        swaps++;
                        console.log(`Step swap at index ${i}: Position ${previousPositions[i]} -> ${currPositions[i]}, Swaps: ${swaps}`);
                        if (soundToggle.checked) {
                            playSound(targetHeights[i] || 400);
                        }
                    }
                }
                previousPositions = currPositions.slice();
            }
            p.drawBars();
        };

        p.reset = function() {
            if (!isReady) return;
            currentStep = 0;
            transitionProgress = 0;
            swaps = 0;
            comparisons = 0;
            if (steps.length > 0 && steps[0].array) {
                currentArray = steps[0].array.map(val => val.toString());
            }
            previousHeights = [];
            previousPositions = [];
            p.drawBars();
            isAnimating = false;
            p.startAnimation();
            document.getElementById('toggleAnimation').textContent = 'Pause';
        };

        function animate() {
            if (isAnimating && steps.length > 0) {
                let speedFactor = animationSpeed / 1000;
                transitionProgress += 0.01 * (1 / speedFactor);
                if (transitionProgress < 1) {
                    p.drawBars();
                    requestAnimationFrame(animate);
                } else if (currentStep < steps.length - 1) {
                    transitionProgress = 0;
                    currentStep++;
                    if (steps[currentStep].array) {
                        currentArray = steps[currentStep].array.map(val => val.toString());
                        if (steps[currentStep - 1].array) {
                            previousHeights = steps[currentStep - 1].array.map(val =>
                                (currentArray.every(v => !isNaN(Number(v)) && v !== '') ? Number(val) : String(val).charCodeAt(0)) /
                                Math.max(...currentArray.map(v => currentArray.every(v => !isNaN(Number(v)) && v !== '') ? Number(v) : String(v).charCodeAt(0))) * (p.height - 100));
                        }
                    }
                    p.drawBars();
                    requestAnimationFrame(animate);
                } else {
                    isAnimating = false;
                    transitionProgress = 1;
                    document.getElementById('toggleAnimation').textContent = 'Restart';
                    p.drawBars();
                }
            }
        }

        function updateCodeHighlight() {
            lineMarks.forEach(mark => mark.clear());
            lineMarks = [];

            if (steps.length === 0 || !steps[currentStep].line) return;

            const lineNumber = steps[currentStep].line - 1;
            if (lineNumber >= 0 && lineNumber < codeEditor.lineCount()) {
                const from = { line: lineNumber, ch: 0 };
                const to = { line: lineNumber, ch: codeEditor.getLine(lineNumber).length };
                const mark = codeEditor.markText(from, to, {
                    css: 'background-color: #44475a; color: #50fa7b; font-weight: bold; padding: 2px 5px; border-radius: 3px;'
                });
                lineMarks.push(mark);
                codeEditor.scrollIntoView({ line: lineNumber, ch: 0 }, 150);
            }
        }

        p.draw = function() {
            if (!isReady) return;
            p.drawBars();
            p.noLoop();
        };
    };

    const p5Instance = new p5(sketch);

    const algorithmCodes = {
        quickSort: {
            JavaScript: `
let arr = [%input%];
console.log("LINE:2");
function partition(arr, low, high) {
    let pivot = arr[high];
    let i = low - 1;
    for (let j = low; j < high; j++) {
        if (arr[j] <= pivot) {
            i++;
            let temp = arr[i];
            arr[i] = arr[j];
            arr[j] = temp;
            console.log("STATE:" + JSON.stringify(arr));
        }
    }
    let temp = arr[i + 1];
    arr[i + 1] = arr[high];
    arr[high] = temp;
    console.log("STATE:" + JSON.stringify(arr));
    return i + 1;
}
function quickSort(arr, low, high) {
    if (low < high) {
        let pi = partition(arr, low, high);
        quickSort(arr, low, pi - 1);
        quickSort(arr, pi + 1, high);
    }
}
quickSort(arr, 0, arr.length - 1);
console.log(arr);
            `,
            Java: `
public class Temp {
    public static void main(String[] args) {
        %type%[] arr = {%input%};
        quickSort(arr, 0, arr.length - 1);
        System.out.println(java.util.Arrays.toString(arr));
    }
    static int partition(%type%[] arr, int low, int high) {
        %type% pivot = arr[high];
        int i = low - 1;
        for (int j = low; j < high; j++) {
            if (%compare%) {
                i++;
                %type% temp = arr[i];
                arr[i] = arr[j];
                arr[j] = temp;
                logState(arr);
            }
        }
        %type% temp = arr[i + 1];
        arr[i + 1] = arr[high];
        arr[high] = temp;
        logState(arr);
        return i + 1;
    }
    static void quickSort(%type%[] arr, int low, int high) {
        if (low < high) {
            int pi = partition(arr, low, high);
            quickSort(arr, low, pi - 1);
            quickSort(arr, pi + 1, high);
        }
    }
}
            `
        },
        insertionSort: {
            JavaScript: `
let arr = [%input%];
for (let i = 1; i < arr.length; i++) {
    let key = arr[i];
    let j = i - 1;
    while (j >= 0 && arr[j] > key) {
        arr[j + 1] = arr[j];
        j--;
        console.log("STATE:" + JSON.stringify(arr));
    }
    arr[j + 1] = key;
    console.log("STATE:" + JSON.stringify(arr));
}
console.log(arr);
            `,
            Java: `
public class Temp {
    public static void main(String[] args) {
        %type%[] arr = {%input%};
        for (int i = 1; i < arr.length; i++) {
            %type% key = arr[i];
            int j = i - 1;
            while (j >= 0 && %compare%) {
                arr[j + 1] = arr[j];
                j--;
                logState(arr);
            }
            arr[j + 1] = key;
            logState(arr);
        }
        System.out.println(java.util.Arrays.toString(arr));
    }
}
            `
        },
        mergeSort: {
            JavaScript: `
let arr = [%input%];
function merge(arr, left, mid, right) {
    let n1 = mid - left + 1;
    let n2 = right - mid;
    let L = arr.slice(left, mid + 1);
    let R = arr.slice(mid + 1, right + 1);
    let i = 0, j = 0, k = left;
    while (i < n1 && j < n2) {
        if (L[i] <= R[j]) {
            arr[k] = L[i];
            i++;
        } else {
            arr[k] = R[j];
            j++;
        }
        console.log("STATE:" + JSON.stringify(arr));
        k++;
    }
    while (i < n1) {
        arr[k] = L[i];
        console.log("STATE:" + JSON.stringify(arr));
        i++;
        k++;
    }
    while (j < n2) {
        arr[k] = R[j];
        console.log("STATE:" + JSON.stringify(arr));
        j++;
        k++;
    }
}
function mergeSort(arr, left, right) {
    if (left < right) {
        let mid = Math.floor((left + right) / 2);
        mergeSort(arr, left, mid);
        mergeSort(arr, mid + 1, right);
        merge(arr, left, mid, right);
    }
}
mergeSort(arr, 0, arr.length - 1);
console.log(arr);
            `,
            Java: `
public class Temp {
    public static void main(String[] args) {
        %type%[] arr = {%input%};
        mergeSort(arr, 0, arr.length - 1);
        System.out.println(java.util.Arrays.toString(arr));
    }
    static void merge(%type%[] arr, int left, int mid, int right) {
        int n1 = mid - left + 1;
        int n2 = right - mid;
        %type%[] L = new %type%[n1];
        %type%[] R = new %type%[n2];
        for (int i = 0; i < n1; i++) L[i] = arr[left + i];
        for (int j = 0; j < n2; j++) R[j] = arr[mid + 1 + j];
        int i = 0, j = 0, k = left;
        while (i < n1 && j < n2) {
            if (%compare%) {
                arr[k] = L[i];
                i++;
            } else {
                arr[k] = R[j];
                j++;
            }
            logState(arr);
            k++;
        }
        while (i < n1) {
            arr[k] = L[i];
            i++;
            k++;
            logState(arr);
        }
        while (j < n2) {
            arr[k] = R[j];
            j++;
            k++;
            logState(arr);
        }
    }
    static void mergeSort(%type%[] arr, int left, int right) {
        if (left < right) {
            int mid = (left + right) / 2;
            mergeSort(arr, left, mid);
            mergeSort(arr, mid + 1, right);
            merge(arr, left, mid, right);
        }
    }
}
            `
        },
        heapSort: {
            JavaScript: `
let arr = [%input%];
function heapify(arr, n, i) {
    let largest = i;
    let left = 2 * i + 1;
    let right = 2 * i + 2;
    if (left < n && arr[left] > arr[largest]) largest = left;
    if (right < n && arr[right] > arr[largest]) largest = right;
    if (largest !== i) {
        let temp = arr[i];
        arr[i] = arr[largest];
        arr[largest] = temp;
        console.log("STATE:" + JSON.stringify(arr));
        heapify(arr, n, largest);
    }
}
function heapSort(arr) {
    let n = arr.length;
    for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
        heapify(arr, n, i);
    }
    for (let i = n - 1; i > 0; i--) {
        let temp = arr[0];
        arr[0] = arr[i];
        arr[i] = temp;
        console.log("STATE:" + JSON.stringify(arr));
        heapify(arr, i, 0);
    }
}
heapSort(arr);
console.log(arr);
            `,
            Java: `
public class Temp {
    public static void main(String[] args) {
        %type%[] arr = {%input%};
        heapSort(arr);
        System.out.println(java.util.Arrays.toString(arr));
    }
    static void heapify(%type%[] arr, int n, int i) {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;
        if (left < n && %compare%) largest = left;
        if (right < n && %compare2%) largest = right;
        if (largest != i) {
            %type% temp = arr[i];
            arr[i] = arr[largest];
            arr[largest] = temp;
            logState(arr);
            heapify(arr, n, largest);
        }
    }
    static void heapSort(%type%[] arr) {
        int n = arr.length;
        for (int i = n / 2 - 1; i >= 0; i--) {
            heapify(arr, n, i);
        }
        for (int i = n - 1; i > 0; i--) {
            %type% temp = arr[0];
            arr[0] = arr[i];
            arr[i] = temp;
            logState(arr);
            heapify(arr, i, 0);
        }
    }
}
            `
        },
        bubbleSort: {
            JavaScript: `
let arr = [%input%];
for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
            let temp = arr[j];
            arr[j] = arr[j + 1];
            arr[j + 1] = temp;
            console.log("STATE:" + JSON.stringify(arr));
        }
    }
}
console.log(arr);
            `,
            Java: `
public class Temp {
    public static void main(String[] args) {
        %type%[] arr = {%input%};
        for (int i = 0; i < arr.length; i++) {
            for (int j = 0; j < arr.length - i - 1; j++) {
                if (%compare%) {
                    %type% temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                    logState(arr);
                }
            }
        }
        System.out.println(java.util.Arrays.toString(arr));
    }
}
            `
        },
        selectionSort: {
            JavaScript: `
let arr = [%input%];
for (let i = 0; i < arr.length - 1; i++) {
    let minIdx = i;
    for (let j = i + 1; j < arr.length; j++) {
        if (arr[j] < arr[minIdx]) {
            minIdx = j;
        }
    }
    if (minIdx !== i) {
        let temp = arr[i];
        arr[i] = arr[minIdx];
        arr[minIdx] = temp;
        console.log("STATE:" + JSON.stringify(arr));
    }
}
console.log(arr);
            `,
            Java: `
public class Temp {
    public static void main(String[] args) {
        %type%[] arr = {%input%};
        for (int i = 0; i < arr.length - 1; i++) {
            int minIdx = i;
            for (int j = i + 1; j < arr.length; j++) {
                if (%compare%) {
                    minIdx = j;
                }
            }
            if (minIdx != i) {
                %type% temp = arr[i];
                arr[i] = arr[minIdx];
                arr[minIdx] = temp;
                logState(arr);
            }
        }
        System.out.println(java.util.Arrays.toString(arr));
    }
}
            `
        }
    };

    algorithmSelect.addEventListener('change', updateCodePreview);
    languageSelect.addEventListener('change', updateCodePreview);

    function showAlert(message) {
        alertContainer.innerHTML = `<div class="alert">${message}</div>`;
        setTimeout(clearAlert, 5000);
    }

    function clearAlert() {
        alertContainer.innerHTML = '';
    }

function validateInput(input) {
        if (!input.trim()) return { isValid: false, isNumeric: true, parts: [] };
        const parts = input.split(',').map(s => s.trim()).filter(s => s.length > 0);
        if (parts.length === 0) return { isValid: false, isNumeric: true, parts: [] };

        // Check for 1 to 50 elements
        if (parts.length < 1 || parts.length > 50) {
            showAlert(`Input must contain between 1 and 50 elements. You entered ${parts.length}.`);
            return { isValid: false, isNumeric: true, parts: [] };
        }

        // Check if all are valid: either numbers (1-100) or non-empty strings
        const isNumeric = parts.every(s => /^\d+$/.test(s));
        if (isNumeric) {
            const numbers = parts.map(s => parseInt(s, 10));
            const isValidRange = numbers.every(n => n >= 1 && n <= 100);
            if (!isValidRange) {
                showAlert('Numeric inputs must be between 1 and 100.');
                return { isValid: false, isNumeric: true, parts: [] };
            }
        } else {
            // Allow strings, but ensure no invalid entries (e.g., empty after trim)
            const isValidStrings = parts.every(s => s.length > 0);
            if (!isValidStrings) {
                showAlert('All inputs must be valid numbers or non-empty strings.');
                return { isValid: false, isNumeric: false, parts: [] };
            }
        }

        const isValid = true; // All checks passed
        return { isValid, isNumeric, parts };
    }

    function updateCodePreview() {
        const algorithm = algorithmSelect.value;
        const language = languageSelect.value;
        const customInput = document.getElementById('customInput').value.trim();
        const { isValid, isNumeric, parts } = validateInput(customInput);
        let inputArray, type, compare, compare2;

        if (!isValid || parts.length === 0) {
            inputArray = DEFAULT_INPUT;
            type = 'int';
            compare = algorithm === 'quickSort' ? 'arr[j] <= pivot'
                    : algorithm === 'insertionSort' ? 'arr[j] > key'
                    : algorithm === 'mergeSort' ? 'L[i] <= R[j]'
                    : algorithm === 'heapSort' ? 'arr[left] > arr[largest]'
                    : algorithm === 'bubbleSort' ? 'arr[j] > arr[j + 1]'
                    : 'arr[j] < arr[minIdx]';
            compare2 = algorithm === 'heapSort' ? 'arr[right] > arr[largest]' : compare;
        } else {
            type = isNumeric ? 'int' : 'String';
            compare = algorithm === 'quickSort'
                ? (isNumeric ? 'arr[j] <= pivot' : 'arr[j].compareTo(pivot) <= 0')
                : algorithm === 'insertionSort'
                ? (isNumeric ? 'arr[j] > key' : 'arr[j].compareTo(key) > 0')
                : algorithm === 'mergeSort'
                ? (isNumeric ? 'L[i] <= R[j]' : 'L[i].compareTo(R[j]) <= 0')
                : algorithm === 'heapSort'
                ? (isNumeric ? 'arr[left] > arr[largest]' : 'arr[left].compareTo(arr[largest]) > 0')
                : algorithm === 'bubbleSort'
                ? (isNumeric ? 'arr[j] > arr[j + 1]' : 'arr[j].compareTo(arr[j + 1]) > 0')
                : (isNumeric ? 'arr[j] < arr[minIdx]' : 'arr[j].compareTo(arr[minIdx]) < 0');
            compare2 = algorithm === 'heapSort'
                ? (isNumeric ? 'arr[right] > arr[largest]' : 'arr[right].compareTo(arr[largest]) > 0')
                : compare;
            inputArray = language === 'Java'
                ? (isNumeric ? parts.join(', ') : '"' + parts.join('", "') + '"')
                : (isNumeric ? parts.join(',') : "'" + parts.join("','") + "'");
        }

        const code = algorithmCodes[algorithm][language]
            .replace('%input%', inputArray)
            .replace(/%type%/g, type)
            .replace('%compare%', compare)
            .replace('%compare2%', compare2);
        codeEditor.setValue(code);
        codeEditor.setOption('mode', language === 'Java' ? 'text/x-java' : 'javascript');
        steps = [];
        currentStep = 0;
        currentArray = parts.length > 0 ? parts : DEFAULT_INPUT.split(',').map(s => s.trim());
        algorithmName = algorithmSelect.options[algorithmSelect.selectedIndex].text;
        if (p5Instance.setup) p5Instance.reset();
    }

visualizeBtn.addEventListener('click', async () => {
        const algorithm = algorithmSelect.value;
        const language = languageSelect.value;
        const customInput = document.getElementById('customInput').value.trim();
        const { isValid, isNumeric, parts } = validateInput(customInput);
        let inputArray, type, compare, compare2;

        if (!isValid || parts.length === 0) {
            if (customInput.length > 0 && !isValid) {
                // Alert already shown in validateInput, just return
                return;
            }
            if (customInput.length > 0) {
                showAlert('Invalid input, using default: ' + DEFAULT_INPUT);
            }
            inputArray = DEFAULT_INPUT;
            type = 'int';
            compare = algorithm === 'quickSort' ? 'arr[j] <= pivot'
                    : algorithm === 'insertionSort' ? 'arr[j] > key'
                    : algorithm === 'mergeSort' ? 'L[i] <= R[j]'
                    : algorithm === 'heapSort' ? 'arr[left] > arr[largest]'
                    : algorithm === 'bubbleSort' ? 'arr[j] > arr[j + 1]'
                    : 'arr[j] < arr[minIdx]';
            compare2 = algorithm === 'heapSort' ? 'arr[right] > arr[largest]' : compare;
        } else {
            clearAlert();
            if (!isNumeric) {
                showAlert('Strings detected; sorting lexicographically.');
            }
            type = isNumeric ? 'int' : 'String';
            compare = algorithm === 'quickSort'
                ? (isNumeric ? 'arr[j] <= pivot' : 'arr[j].compareTo(pivot) <= 0')
                : algorithm === 'insertionSort'
                ? (isNumeric ? 'arr[j] > key' : 'arr[j].compareTo(key) > 0')
                : algorithm === 'mergeSort'
                ? (isNumeric ? 'L[i] <= R[j]' : 'L[i].compareTo(R[j]) <= 0')
                : algorithm === 'heapSort'
                ? (isNumeric ? 'arr[left] > arr[largest]' : 'arr[left].compareTo(arr[largest]) > 0')
                : algorithm === 'bubbleSort'
                ? (isNumeric ? 'arr[j] > arr[j + 1]' : 'arr[j].compareTo(arr[j + 1]) > 0')
                : (isNumeric ? 'arr[j] < arr[minIdx]' : 'arr[j].compareTo(arr[minIdx]) < 0');
            compare2 = algorithm === 'heapSort'
                ? (isNumeric ? 'arr[right] > arr[largest]' : 'arr[right].compareTo(arr[largest]) > 0')
                : compare;
            inputArray = language === 'Java'
                ? (isNumeric ? parts.join(', ') : '"' + parts.join('", "') + '"')
                : (isNumeric ? parts.join(',') : "'" + parts.join("','") + "'");
        }

        const code = algorithmCodes[algorithm][language]
            .replace('%input%', inputArray)
            .replace(/%type%/g, type)
            .replace('%compare%', compare)
            .replace('%compare2%', compare2);

        try {
            p5Instance.stopAnimation();
            const response = await fetch('/codeflowpro/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language })
            });

            if (!response.ok) throw new Error((await response.json()).error || 'Failed to execute code');
            const data = await response.json();
            if (data.status === 'success') {
                outputResult.textContent = `Output: ${data.output}`;
                executionTime.textContent = `Execution Time: ${data.executionTime} ms`;
                steps = data.steps || [];
                console.log('Steps received:', steps);
                algorithmName = algorithmSelect.options[algorithmSelect.selectedIndex].text;

                if (steps.length > 0) {
                    currentStep = 0;
                    const firstArrayStep = steps.find(s => s.array) || { array: parts.length > 0 ? parts : DEFAULT_INPUT.split(',').map(s => s.trim()) };
                    currentArray = firstArrayStep.array.map(val => val.toString());
                    p5Instance.reset();
                    p5Instance.setStep(0);
                    p5Instance.startAnimation();
                } else {
                    currentArray = parts.length > 0 ? parts : DEFAULT_INPUT.split(',').map(s => s.trim());
                    p5Instance.drawBars();
                }
                if (isValid) clearAlert();
            }
        } catch (error) {
            console.error('Error visualizing algorithm:', error);
            showAlert('Error: ' + error.message);
        }
    });



    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'toggleAnimation') {
            if (isAnimating) {
                p5Instance.stopAnimation();
                e.target.textContent = 'Resume';
            } else {
                p5Instance.startAnimation();
                e.target.textContent = 'Pause';
            }
        } else if (e.target.id === 'stepForward') {
            p5Instance.stopAnimation();
            p5Instance.setStep(currentStep + 1);
            document.getElementById('toggleAnimation').textContent = 'Resume';
        } else if (e.target.id === 'stepBackward') {
            p5Instance.stopAnimation();
            p5Instance.setStep(currentStep - 1);
            document.getElementById('toggleAnimation').textContent = 'Resume';
        } else if (e.target.id === 'reset') {
            p5Instance.reset();
        }
    });

    document.getElementById('speedSlider')?.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value);
        p5Instance.setSpeed(speed);
        document.getElementById('speedValue').textContent = speed + 'ms';
    });

    setTimeout(updateCodePreview, 100);
});