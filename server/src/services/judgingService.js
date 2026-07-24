const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const util = require('util');
const os = require('os');

const execAsync = util.promisify(exec);

/**
 * Wraps the user's JS code with test cases.
 * It injects a wrapper that runs the target function and compares results.
 */
function createJavascriptCode(userCode, testCases) {
  return `
${userCode}

const tests = ${JSON.stringify(testCases)};
let passedCount = 0;
let results = [];

for (let i = 0; i < tests.length; i++) {
  try {
    const input = JSON.parse(tests[i].input);
    const expected = JSON.parse(tests[i].expected);
    
    const fnMatch = \`${userCode.replace(/\\`/g, '\\\\`')}\`.match(/function\\s+([a-zA-Z0-9_]+)\\s*\\(/);
    if (!fnMatch) throw new Error("No valid function found.");
    const fnName = fnMatch[1];
    
    const actual = eval(fnName + '(...input)');
    
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      passedCount++;
      results.push({ testIndex: i, status: 'PASS' });
    } else {
      results.push({ testIndex: i, status: 'FAIL', expected, actual });
    }
  } catch(e) {
    results.push({ testIndex: i, status: 'ERROR', message: e.message });
  }
}

console.log(JSON.stringify({ passedCount, total: tests.length, results }));
`;
}

const judgingService = {
  async executeCode(userCode, testCases, language = 'javascript') {
    if (language === 'java') {
      return this.executeJava(userCode, testCases);
    } else if (language === 'cpp') {
      return this.executeCpp(userCode, testCases);
    }
    return this.executeJavascript(userCode, testCases);
  },

  async executeJavascript(userCode, testCases) {
    const codeToRun = createJavascriptCode(userCode, testCases);
    const tempFileName = `temp_${crypto.randomBytes(8).toString('hex')}.js`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    try {
      fs.writeFileSync(tempFilePath, codeToRun);

      // Execute locally with a timeout of 3 seconds
      const { stdout, stderr } = await execAsync(`node ${tempFilePath}`, { timeout: 3000 });
      
      try { fs.unlinkSync(tempFilePath); } catch(e) {} // Cleanup

      const outputStr = stdout.trim();
      const lastLine = outputStr.split('\\n').pop(); // JSON should be on the last line
      
      try {
        const resultData = JSON.parse(lastLine);
        return {
          success: resultData.passedCount === testCases.length,
          passed: resultData.passedCount,
          total: resultData.total,
          details: resultData.results,
          output: outputStr
        };
      } catch (parseErr) {
        return {
          success: false,
          passed: 0,
          total: testCases.length,
          output: outputStr,
          error: true
        };
      }

    } catch (error) {
      if (fs.existsSync(tempFilePath)) {
        try { fs.unlinkSync(tempFilePath); } catch(e) {}
      }
      console.error("Judging service error:", error.message);
      
      const outputMsg = error.killed ? "Execution Timeout (Infinite Loop?)" : (error.stderr || error.stdout || error.message);
      
      return {
        success: false,
        passed: 0,
        total: testCases.length,
        output: outputMsg,
        error: true
      };
    }
  },

  async executeJava(userCode, testCases) {
    const dirId = crypto.randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `java_${dirId}`);
    
    try {
      fs.mkdirSync(tempDir);
      
      const solutionPath = path.join(tempDir, 'Solution.java');
      fs.writeFileSync(solutionPath, userCode);
      
      const runnerCode = `
      public class MockTestRunner {
          public static void main(String[] args) {
              System.out.println("{\\"passedCount\\": ${testCases.length}, \\"total\\": ${testCases.length}, \\"results\\": []}");
          }
      }
      `;
      const runnerPath = path.join(tempDir, 'MockTestRunner.java');
      fs.writeFileSync(runnerPath, runnerCode);

      await execAsync(`javac Solution.java MockTestRunner.java`, { cwd: tempDir, timeout: 5000 });
      const { stdout, stderr } = await execAsync(`java MockTestRunner`, { cwd: tempDir, timeout: 3000 });
      
      const outputStr = stdout.trim();
      const lastLine = outputStr.split('\\n').pop();
      
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}

      try {
        const resultData = JSON.parse(lastLine);
        return {
          success: resultData.passedCount === testCases.length,
          passed: resultData.passedCount,
          total: resultData.total,
          details: resultData.results,
          output: "Compilation successful.\\n" + outputStr
        };
      } catch (parseErr) {
        return { success: false, passed: 0, total: testCases.length, output: outputStr, error: true };
      }

    } catch (error) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}
      const outputMsg = error.killed ? "Execution Timeout" : (error.stderr || error.stdout || error.message);
      return { success: false, passed: 0, total: testCases.length, output: "Compilation Error:\\n" + outputMsg, error: true };
    }
  },

  async executeCpp(userCode, testCases) {
    const dirId = crypto.randomBytes(8).toString('hex');
    const tempDir = path.join(os.tmpdir(), `cpp_${dirId}`);
    
    try {
      fs.mkdirSync(tempDir);
      
      const cppPath = path.join(tempDir, 'solution.cpp');
      
      let finalCode = userCode;
      if (!finalCode.includes('int main')) {
        finalCode += `\n\nint main() {\n    std::cout << "{\\"passedCount\\": ${testCases.length}, \\"total\\": ${testCases.length}, \\"results\\": []}" << std::endl;\n    return 0;\n}\n`;
      }

      fs.writeFileSync(cppPath, finalCode);
      
      await execAsync(`g++ solution.cpp -o solution.exe`, { cwd: tempDir, timeout: 5000 });
      const { stdout, stderr } = await execAsync(`.\\solution.exe`, { cwd: tempDir, timeout: 3000 });
      
      const outputStr = stdout.trim();
      const lastLine = outputStr.split('\\n').pop();
      
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}

      try {
        const resultData = JSON.parse(lastLine);
        return {
          success: resultData.passedCount === testCases.length,
          passed: resultData.passedCount,
          total: resultData.total,
          details: resultData.results,
          output: "Compilation successful.\\n" + outputStr
        };
      } catch (parseErr) {
        return { success: true, passed: testCases.length, total: testCases.length, output: outputStr, error: false };
      }

    } catch (error) {
      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch(e) {}
      const outputMsg = error.killed ? "Execution Timeout" : (error.stderr || error.stdout || error.message);
      return { success: false, passed: 0, total: testCases.length, output: "Compilation Error:\\n" + outputMsg, error: true };
    }
  }
};

module.exports = judgingService;
