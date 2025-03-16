const code = process.argv[2];

try {
    const instrumentedCode = `
        let debugState = { steps: [], callStack: [], scope: {} };
        function logStep(line, type, func, vars) {
            const safeVars = {};
            for (const [k, v] of Object.entries(vars || {})) {
                try { JSON.stringify(v); safeVars[k] = v; } catch (e) { safeVars[k] = 'unserializable'; }
            }
            debugState.steps.push({ line, type, func, variables: safeVars });
        }
        function updateScope(name, value) {
            debugState.scope[name] = value;
        }
        ${code.split('\n').map((line, i) => {
            const lineNum = i + 1;
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('}') || trimmed.startsWith('console.log')) return line;
            let instr = `let localVars_${lineNum} = { ...debugState.scope, ...Object.keys(arguments).reduce((acc, k) => { acc['arg' + k] = arguments[k]; return acc; }, {}) };\n`;
            instr += `logStep(${lineNum}, 'line', null, localVars_${lineNum});\n`;
            if (trimmed.includes('function')) {
                const funcMatch = trimmed.match(/function\s+(\w+)\s*\(/);
                if (funcMatch) instr += `logStep(${lineNum}, 'call', '${funcMatch[1]}', localVars_${lineNum});\n`;
            } else if (trimmed.startsWith('return')) {
                instr += `logStep(${lineNum}, 'return', null, localVars_${lineNum});\n`;
            } else if (/^(let|const|var)\s+(\w+)/.test(trimmed)) {
                const varMatch = trimmed.match(/^(let|const|var)\s+(\w+)/);
                instr += `${line}\n`;
                instr += `setTimeout(() => { try { localVars_${lineNum}.${varMatch[2]} = ${varMatch[2]}; updateScope('${varMatch[2]}', ${varMatch[2]}); logStep(${lineNum}, 'assign', null, localVars_${lineNum}); } catch (e) { localVars_${lineNum}.${varMatch[2]} = 'undefined'; } }, 0);\n`;
                return instr;
            } else if (trimmed.includes('=')) {
                const varMatch = trimmed.match(/(\w+)\s*=/);
                if (varMatch) {
                    instr += `${line}\n`;
                    instr += `setTimeout(() => { try { localVars_${lineNum}.${varMatch[1]} = ${varMatch[1]}; updateScope('${varMatch[1]}', ${varMatch[1]}); logStep(${lineNum}, 'assign', null, localVars_${lineNum}); } catch (e) { localVars_${lineNum}.${varMatch[1]} = 'undefined'; } }, 0);\n`;
                    return instr;
                }
            }
            return instr + line;
        }).join('\n')}
        console.log('DEBUG:' + JSON.stringify(debugState));
    `;
    const func = new Function(instrumentedCode);
    func();
} catch (error) {
    console.error("Execution error:", error.message);
    process.exit(1);
}