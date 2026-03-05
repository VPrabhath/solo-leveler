import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface TestCase {
  input: string
  expected_output: string
  is_hidden: boolean
}

// Analyze code complexity based on patterns
function analyzeComplexity(code: string, language: string): { time_complexity: string; space_complexity: string; explanation: string } {
  const lines = code.split('\n')
  const cleanCode = language === 'python'
    ? code.replace(/#.*$/gm, '')
    : code.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')

  let maxNesting = 0
  let hasRecursion = false
  let hasSorting = false
  let hasHashMap = false
  let hasBinarySearch = false
  let hasExtraArrays = false

  // Detect function name for recursion check
  let funcName: string | undefined
  if (language === 'python') {
    const funcMatch = cleanCode.match(/def\s+(\w+)/)
    funcName = funcMatch?.[1]
  } else {
    const funcMatch = cleanCode.match(/function\s+(\w+)/)
    funcName = funcMatch?.[1]
  }

  // Count nested loops
  let currentNesting = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (language === 'python') {
      if (/^(for|while)\s/.test(trimmed)) {
        currentNesting++
        maxNesting = Math.max(maxNesting, currentNesting)
      }
      // Python dedent detection (approximate)
      if (trimmed === '' || (!trimmed.startsWith(' ') && !trimmed.startsWith('\t') && currentNesting > 0)) {
        // rough reset on top-level lines
      }
    } else {
      if (/\b(for|while)\s*\(/.test(trimmed)) {
        currentNesting++
        maxNesting = Math.max(maxNesting, currentNesting)
      }
      if (trimmed.includes('}')) {
        currentNesting = Math.max(0, currentNesting - 1)
      }
    }
  }

  // Detect patterns
  if (funcName && cleanCode.includes(funcName + '(') && cleanCode.split(funcName + '(').length > 2) {
    hasRecursion = true
  }

  if (language === 'python') {
    if (/\.sort\s*\(|sorted\s*\(/.test(cleanCode)) hasSorting = true
    if (/dict\s*\(|\{\s*\}|defaultdict|Counter/.test(cleanCode)) hasHashMap = true
    if (/\/\/\s*2|bisect|binary_search/i.test(cleanCode)) hasBinarySearch = true
    if (/\[\s*\]|list\s*\(|\.append|\.extend/.test(cleanCode)) hasExtraArrays = true
  } else {
    if (/\.sort\s*\(/.test(cleanCode)) hasSorting = true
    if (/new\s+(Map|Set|Object)\s*\(/.test(cleanCode) || /\{\s*\}/.test(cleanCode) || /new\s+Map/.test(cleanCode)) hasHashMap = true
    if (/Math\.(floor|ceil).*\/\s*2/.test(cleanCode) || />>.*1/.test(cleanCode) || /binarySearch|binary_search/i.test(cleanCode)) hasBinarySearch = true
    if (/new\s+Array|Array\(|\[\s*\]|\.map\s*\(|\.filter\s*\(|\.slice\s*\(/.test(cleanCode)) hasExtraArrays = true
  }

  // Determine time complexity
  let timeComplexity = 'O(1)'
  let explanation = 'Constant time operations'

  if (hasBinarySearch) {
    timeComplexity = 'O(log n)'
    explanation = 'Binary search pattern detected'
  } else if (hasSorting && maxNesting <= 1) {
    timeComplexity = 'O(n log n)'
    explanation = 'Sorting dominates the time complexity'
  } else if (maxNesting === 1) {
    timeComplexity = 'O(n)'
    explanation = 'Single loop iteration'
  } else if (maxNesting === 2) {
    timeComplexity = 'O(n²)'
    explanation = 'Nested loops detected'
  } else if (maxNesting >= 3) {
    timeComplexity = 'O(n³)'
    explanation = `${maxNesting} levels of nested loops`
  }

  if (hasRecursion && timeComplexity === 'O(1)') {
    timeComplexity = 'O(2^n)'
    explanation = 'Recursive calls without memoization'
  }

  // Determine space complexity
  let spaceComplexity = 'O(1)'
  if (hasHashMap || hasExtraArrays) {
    spaceComplexity = 'O(n)'
  }
  if (hasRecursion) {
    spaceComplexity = spaceComplexity === 'O(1)' ? 'O(n)' : spaceComplexity
  }
  if (maxNesting >= 2 && hasExtraArrays) {
    spaceComplexity = 'O(n²)'
  }

  return { time_complexity: timeComplexity, space_complexity: spaceComplexity, explanation }
}

// Execute Python code using Pyodide via CDN
async function executePython(code: string, input: string): Promise<string> {
  // We use a simple Python evaluation approach via Pyodide
  // Wrap user code to capture output
  const wrappedPythonCode = `
import sys
import json
import io

# Redirect stdout
old_stdout = sys.stdout
sys.stdout = buffer = io.StringIO()

try:
    # Parse input
    input_val = ${input}
    
    # Execute user code
${code.split('\n').map(l => '    ' + l).join('\n')}
    
    # Call solution with input
    if callable(solution):
        if isinstance(input_val, list):
            result = solution(*input_val)
        else:
            result = solution(input_val)
        print(json.dumps(result), end='')
    
except Exception as e:
    print(f"Error: {e}", end='')

sys.stdout = old_stdout
output = buffer.getvalue()
output
`

  // Use Pyodide WASM runtime
  const pyodideModule = await import('https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js')
  const pyodide = await pyodideModule.loadPyodide()
  const result = await pyodide.runPythonAsync(wrappedPythonCode)
  return String(result || '')
}

// Execute JavaScript code
function executeJavaScript(code: string, input: string): string {
  const wrappedCode = `
    ${code}
    const __input = ${input};
    const __result = typeof solution === 'function' 
      ? (Array.isArray(__input) ? solution(...__input) : solution(__input))
      : undefined;
    __result;
  `
  const evalFn = new Function(wrappedCode)
  const result = evalFn()
  return JSON.stringify(result)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { code, language, test_cases, time_limit_seconds = 5 } = await req.json()

    if (!code || !test_cases || !Array.isArray(test_cases)) {
      return new Response(JSON.stringify({ error: 'Missing code or test_cases' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Analyze code complexity
    const complexity = analyzeComplexity(code, language || 'javascript')
    const results: { passed: boolean; input: string; expected: string; actual: string }[] = []
    let totalPassed = 0
    const startTime = Date.now()

    // Preliminary syntax check for JavaScript
    if (language === 'javascript' || !language) {
      try {
        new Function(code);
      } catch (err: any) {
        return new Response(JSON.stringify({
          passed: 0,
          total: test_cases.length,
          error: `Syntax Error: ${err.message}`,
          results: test_cases.map((tc: TestCase) => ({
            passed: false,
            input: tc.input,
            expected: tc.expected_output,
            actual: `Syntax Error: ${err.message}`
          })),
          execution_time_ms: 0,
          complexity,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    for (const tc of test_cases as TestCase[]) {
      try {
        let actual: string

        if (language === 'javascript') {
          actual = executeJavaScript(code, tc.input)
        } else if (language === 'python') {
          // For Python, we simulate execution by parsing and running with basic eval
          // We implement a lightweight Python-compatible JS evaluator for common patterns
          actual = await executePythonSafe(code, tc.input)
        } else {
          actual = 'Language not yet supported for execution'
        }

        const expectedTrimmed = tc.expected_output.trim()
        const actualTrimmed = actual.trim()
        const passed = actualTrimmed === expectedTrimmed

        if (passed) totalPassed++
        results.push({ passed, input: tc.input, expected: expectedTrimmed, actual: actualTrimmed })
      } catch (err: any) {
        results.push({ passed: false, input: tc.input, expected: tc.expected_output, actual: `Error: ${err.message}` })
      }
    }

    const executionTime = Date.now() - startTime

    return new Response(JSON.stringify({
      passed: totalPassed,
      total: test_cases.length,
      results,
      execution_time_ms: executionTime,
      complexity,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

// Safe Python execution using transpiled approach
async function executePythonSafe(code: string, input: string): Promise<string> {
  // Transpile common Python patterns to JS for execution
  // This handles most competitive programming patterns
  try {
    const jsCode = transpilePythonToJS(code)
    return executeJavaScript(jsCode, input)
  } catch (e: any) {
    // Fallback: try direct interpretation of simple cases
    throw new Error(`Python execution failed: ${e.message}`)
  }
}

// Transpile basic Python to JavaScript
function transpilePythonToJS(pythonCode: string): string {
  let js = pythonCode

  // Function definitions
  js = js.replace(/def\s+(\w+)\s*\(([^)]*)\)\s*:/g, 'function $1($2) {')

  // Return statements (no change needed)
  // If/elif/else
  js = js.replace(/elif\s+(.+?):/g, '} else if ($1) {')
  js = js.replace(/if\s+(.+?):/g, 'if ($1) {')
  js = js.replace(/else\s*:/g, '} else {')

  // For loops with range
  js = js.replace(/for\s+(\w+)\s+in\s+range\s*\((\d+)\s*,\s*(\d+)\s*(?:,\s*(-?\d+))?\s*\)\s*:/g, (_, v, start, end, step) => {
    const s = step || '1'
    const op = parseInt(s) >= 0 ? '<' : '>'
    return `for (let ${v} = ${start}; ${v} ${op} ${end}; ${v} += ${s}) {`
  })
  js = js.replace(/for\s+(\w+)\s+in\s+range\s*\((\d+)\s*\)\s*:/g, 'for (let $1 = 0; $1 < $2; $1++) {')
  js = js.replace(/for\s+(\w+)\s+in\s+(.+?)\s*:/g, 'for (const $1 of $2) {')

  // While loops
  js = js.replace(/while\s+(.+?)\s*:/g, 'while ($1) {')

  // Python operators
  js = js.replace(/\band\b/g, '&&')
  js = js.replace(/\bor\b/g, '||')
  js = js.replace(/\bnot\b/g, '!')
  js = js.replace(/\bTrue\b/g, 'true')
  js = js.replace(/\bFalse\b/g, 'false')
  js = js.replace(/\bNone\b/g, 'null')
  js = js.replace(/\*\*(\d+)/g, '**$1')

  // List/dict operations
  js = js.replace(/(\w+)\.append\((.+?)\)/g, '$1.push($2)')
  js = js.replace(/(\w+)\.extend\((.+?)\)/g, '$1.push(...$2)')
  js = js.replace(/len\((.+?)\)/g, '$1.length')
  js = js.replace(/abs\((.+?)\)/g, 'Math.abs($1)')
  js = js.replace(/max\((.+?)\)/g, 'Math.max(...($1))')
  js = js.replace(/min\((.+?)\)/g, 'Math.min(...($1))')
  js = js.replace(/sorted\((.+?)\)/g, '[...$1].sort((a,b)=>a-b)')
  js = js.replace(/sum\((.+?)\)/g, '$1.reduce((a,b)=>a+b,0)')
  js = js.replace(/str\((.+?)\)/g, 'String($1)')
  js = js.replace(/int\((.+?)\)/g, 'parseInt($1)')
  js = js.replace(/float\((.+?)\)/g, 'parseFloat($1)')

  // Handle indentation → braces
  // Convert indented blocks to { } using indentation tracking
  js = convertIndentationToBraces(js)

  return js
}

function convertIndentationToBraces(code: string): string {
  const lines = code.split('\n')
  const result: string[] = []
  const indentStack: number[] = [0]

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trimStart()
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('#')) result.push('//' + trimmed.slice(1))
      continue
    }

    const currentIndent = line.length - trimmed.length
    const prevIndent = indentStack[indentStack.length - 1]

    if (currentIndent > prevIndent) {
      // Increased indentation - opening already added via {
      indentStack.push(currentIndent)
    } else if (currentIndent < prevIndent) {
      // Decreased indentation - close braces
      while (indentStack.length > 1 && indentStack[indentStack.length - 1] > currentIndent) {
        indentStack.pop()
        result.push('  '.repeat(indentStack.length) + '}')
      }
    }

    // Skip lines that are already control structures (already have {)
    if (trimmed.endsWith('{')) {
      result.push(line)
    } else if (trimmed.endsWith(':') && !trimmed.startsWith('//')) {
      // Remaining Python colon lines not caught by regex - handle gracefully
      result.push(line.replace(/:$/, ' {'))
    } else {
      result.push(line)
    }
  }

  // Close remaining open braces
  while (indentStack.length > 1) {
    indentStack.pop()
    result.push('  '.repeat(indentStack.length) + '}')
  }

  return result.join('\n')
}
