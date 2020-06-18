// Copyright (c) 2020 Qingpeng Li. All rights reserved.
// Author: qingpeng9802@gmail.com (Qingpeng Li).

'use strict'

class Symb {
    constructor(str) {
        this.str = str;
    }
    toString() {
        return this.str;
    }
}

/** The symbol table */
let symbol_table = {};

/** Find or create unique Symb entry for str s in symbol table. */
function Sym(s) {
    if (!(s in symbol_table)) {
        symbol_table[s] = new Symb(s);
    }
    return symbol_table[s];
}

let [_quote, _if, _set, _define, _lambda, _begin, _definemacro] =
    "quote   if   set!  define   lambda   begin   define-macro".split(/\s+/).map(x => Sym(x));

let [_quasiquote, _unquote, _unquotesplicing] =
    "quasiquote   unquote   unquote-splicing".split(/\s+/).map(x => Sym(x));

let [_append, _cons, _let] = "append cons let".split(/\s+/).map(x => Sym(x));

let eof_object = new Symb('#<eof-object>'); // Note: uninterned; can't be read

let quotes = { "'": _quote, "`": _quasiquote, ",": _unquote, ",@": _unquotesplicing };

let macro_table = { 'let': let_ }; // More macros can go here

// ---------------------------  parse, read, and user interaction

/** Parse a program: read and expand/error-check it. */
function parse(inport) {
    // Backwards compatibility: given a str, convert it to an InPort
    if (typeof inport === 'string') {
        inport = new InPort(inport);
    }
    return expand(read(inport), true);
}

/** An input port. Retains a line of chars. */
class InPort {
    constructor(fileStr) {
        this.file = fileStr;
        this.line = '';
        this.lines = this.file.split('\n');
    }

    /** Return the next token, reading new text into line buffer if needed. */
    next_token() {
        let tokenizer = new RegExp(/\s*(,@|[('`,)]|"(?:[\\].|[^\\"])*"|;.*|[^\s('"`,;)]*)(.*)/,
            'g');
        while (this.lines) {
            if (this.line == '') {
                this.line = this.lines.shift();
                tokenizer.lastIndex = 0;
            }
            let result = tokenizer.exec(this.line);
            let token = result[1];
            this.line = result[2];
            if (token == 'undefined') {
                break;
            }
            if (token != '' && !(token.startsWith(';'))) {
                console.log(token);
                return token;
            }
        }
        return eof_object;
    }
}

/** Read a Scheme expression from an input port. */
function read(inport) {
    function read_ahead(token) {
        if ('(' == token) {
            let L = [];
            while (true) {
                token = inport.next_token();
                if (token == ')') {
                    return L;
                } else {
                    let res = read_ahead(token);
                    if (res == undefined) {
                        return L;
                    }
                    L.push(res);
                }
            }
        } else if (')' == token) {
            throw new SyntaxError('unexpected )');
        } else if (token in quotes) {
            return [quotes[token], read(inport)];
        } else if (token == eof_object) {
            // Notice: no assuming reading from repl
            return undefined;
        } else {
            return atom(token);
        }
    }
    // body of read:
    let token1 = inport.next_token();
    return token1 == eof_object ? eof_object : read_ahead(token1);
}

/** Numbers become numbers; #t and #f are booleans; "..." string; otherwise Symb. */
function atom(token) {
    if (token == '#t') {
        return true;
    } else if (token == '#f') {
        return false;
    } else if (token[0] != undefined && token[0] == '"') {
        return token.slice(1, -1);
    }
    // Notice: complex not support here
    let intNum = parseInt(token);
    if (isNaN(intNum)) {
        let floatNum = parseFloat(token);
        if (isNaN(floatNum)) {
            return Sym(token);
        } else {
            return floatNum;
        }
    } else {
        return intNum;
    }
}

/** Convert a JavaScript object back into a Lisp-readable string. */
function to_string(x) {
    if (x === true) {
        return '#t';
    } else if (x === false) {
        return '#f';
    } else if (x instanceof Symb) {
        return x.toString();
    } else if (typeof x === 'string') {
        return '"' + x + '"';
    } else if (Array.isArray(x)) {
        let mappedx = x.map(to_string);
        return '(' + mappedx.join(' ') + ')';
        // Notice: complex not support here
    } else {
        return String(x);
    }
}

/** Eval every expression from a string of file. */
function load(fileStr) {
    try {
        let x = parse(fileStr);
        if (x == eof_object) {
            return;
        }
        let val = evalua(x);
        if (val != undefined) {
            console.log(to_string(val));
            return to_string(val);
        }
        return "!undefined";
    } catch (e) {
        console.log(e.stack);
        return '*** ERROR ***';
    }
}

// -------------------------------------- Environment class

/** Implement `zip()` in JavaScript */
function zip(arrKey, arrVal) {
    let dict = {};
    for (let i = 0; i < arrKey.length; i++) {
        dict[arrKey[i]] = arrVal[i];
    }
    return dict;
}

class Env {
    /** An environment: a dict of {'var':val} pairs, with an outer Env. */
    constructor(parms = [], args = [], outer = undefined) {
        this.outer = outer;
        this.env = {};
        if (parms instanceof Symb) {
            this.env = Object.assign(this.env, zip(parms, args));
        } else {
            if (args.length != parms.length) {
                throw new SyntaxError('args.length: ' + args.length +
                    ' != parms.length: ' + parms.length + '\n' +
                    'args: ' + args + 'parms: ' + parms);
            }
            this.env = Object.assign(this.env, zip(parms, args));
        }
    }

    /** Update `Env` with new binding list */
    updateEnv(dict) {
        this.env = Object.assign(this.env, dict);
        return this.env;
    }

    /** Find the innermost Env where var appears. */
    find(v) {
        console.log(this.env)
        console.log(v)
        if (typeof v !== 'string') {
            v = v.toString();
        }
        if (v in this.env) {
            return this.env;
        } else if (this.outer == undefined) {
            throw new ReferenceError(v);
        } else {
            return this.outer.find(v);
        }
    }
}

function is_pair(x) {
    return x.length != 0 && Array.isArray(x);
}

function cons(x, y) {
    return [x].concat(y);
}

/** Call proc with current continuation; escape only */
function callcc(proc) {
    let ball = new EvalError("Sorry, can't continue this continuation any longer.");
    function raise(retval) {
        ball.retval = retval;
        throw ball;
    }
    try {
        return proc(raise);
    } catch (w) {
        if (w == ball) {
            return ball.retval;
        } else {
            throw w;
        }
    }
}

/** Add some Scheme standard procedures. */
function add_globals(env) {
    let operations = {
        '+': function (x, y) { return x + y },
        '-': function (x, y) { return x - y },
        '*': function (x, y) { return x * y },
        '/': function (x, y) { return x / y },
        'not': function (x) { return !x },
        '>': function (x, y) { return x > y },
        '<': function (x, y) { return x < y },
        '>=': function (x, y) { return x >= y },
        '<=': function (x, y) { return x <= y },
        '=': function (x, y) { return x === y },
        'equal?': function (x, y) { return x == y },
        'eq?': function (x, y) { return x === y },
        'length': function (x) { return x.length },
        'cons': cons,
        'car': function (x) { return x[0] },
        'cdr': function (x) { return x.slice(1) },
        'append': function (x, y) { return x.concat(y) },
        'list': function (...args) { return args },
        'list?': function (x) { return Array.isArray(x) },
        'null?': function (x) { return (!x || x.length === 0) },
        'symbol?': function (x) { return x instanceof Symb },
        'boolean?': function (x) { return typeof x === 'boolean' },
        'pair?': is_pair,
        'apply': function (proc, l) { return proc(...l) },
        'eval': function (x) { return evalua(expand(x)) },
        'call/cc': callcc,
        'display': function (x) { console.log((typeof x === 'string') ? x : to_string(x)) }
    };

    let mathops = {
        'abs': function (x) { return Math.abs(x) },
        'acos': function (x) { return Math.acos(x) },
        'acosh': function (x) { return Math.acosh(x) },
        'asin': function (x) { return Math.asin(x) },
        'asinh': function (x) { return Math.asinh(x) },
        'atan': function (x) { return Math.atan(x) },
        'atanh': function (x) { return Math.atanh(x) },
        'atan2': function (y, x) { return Math.atan2(y, x) },
        'cbrt': function (x) { return Math.cbrt(x) },
        'ceil': function (x) { return Math.ceil(x) },
        'clz32': function (x) { return Math.clz32(x) },
        'cos': function (x) { return Math.cos(x) },
        'cosh': function (x) { return Math.cosh(x) },
        'exp': function (x) { return Math.exp(x) },
        'expm1': function (x) { return Math.expm1(x) },
        'floor': function (x) { return Math.floor(x) },
        'fround': function (x) { return Math.fround(x) },
        'hypot': function (...args) { return Math.hypot(...args) },
        'imul': function (x) { return Math.imul(x, y) },
        'log': function (x) { return Math.log(x) },
        'log1p': function (x) { return Math.log1p(x) },
        'log10': function (x) { return Math.log10(x) },
        'log2': function (x) { return Math.log2(x) },
        'max': function (...args) { return Math.max(...args) },
        'min': function (...args) { return Math.min(...args) },
        'pow': function (x, y) { return Math.pow(x, y) },
        'random': function () { return Math.random() },
        'round': function (x) { return Math.round(x) },
        'sign': function (x) { return Math.sign(x) },
        'sin': function (x) { return Math.sin(x) },
        'sinh': function (x) { return Math.sinh(x) },
        'sqrt': function (x) { return Math.sqrt(x) },
        'tan': function (x) { return Math.tan(x) },
        'tanh': function (x) { return Math.tanh(x) },
        'tosource': function () { return Math.toSource() },
        'trunc': function (x) { return Math.trunc(x) }
    };

    env.updateEnv(operations);
    env.updateEnv(mathops);

    return env;
}

let global_env = add_globals(new Env());

// -------------------------------- eval (tail recursive)

/** Evaluate an expression in an environment. */
function evalua(x, env = global_env) {
    while (true) {
        //console.log(x);
        if (x instanceof Symb) {                            // variable reference
            return env.find(x)[x];
        } else if (!Array.isArray(x)) {                     // constant literal
            return x;
        } else if (x[0] != undefined && x[0] === _quote) {  // (quote exp)
            return x[1];
        } else if (x[0] != undefined && x[0] === _if) {     // (if test conseq alt)
            x = evalua(x[1], env) ? x[2] : x[3];
        } else if (x[0] != undefined && x[0] === _set) {    // (set! var exp)
            let vr = [1];
            env.find(vr)[vr] = evalua(x[2], env);
            return undefined;
        } else if (x[0] != undefined && x[0] === _define) { // (define var exp)
            let vr = x[1];
            return env[vr] = evalua(x[2], env);
        } else if (x[0] != undefined && x[0] === _lambda) { // (lambda (var*) exp)
            let vrs = x[1];
            let exp = x[2];
            // Notice: class `Procedure` is implemented this way
            return function (...args) {
                return evalua(exp, new Env(vrs, args, env));
            };
        } else if (x[0] != undefined && x[0] === _begin) {  // (begin exp+)
            x.slice(1, -1).forEach(function (exp) {
                evalua(exp, env);
            });
            x = x.slice(-1)[0];
        } else {                                            // (proc exp*)
            let exps = x.map(function (exp) {
                return evalua(exp, env);
            });
            let proc = exps.shift();
            if (typeof proc === 'function') {
                return proc.apply(env, exps);
            } else {
                throw new TypeError('proc is not type: function, cannot eval proc');
            }
        }
    }
}

// --------------------- expand

/** Walk tree of x, making optimizations/fixes, and signaling SyntaxError. */
function expand(x, toplevel = false) {
    //console.log(x);
    if (x == undefined) {
        return undefined;
    }
    require(x, x.length != 0);                                // () => Error
    if (!Array.isArray(x)) {                                  // constant => unchanged
        return x;
    } else if (x[0] == _quote) {                              // (quote exp)
        require(x, x.length == 2);
        return x;
    } else if (x[0] == _if) {
        if (x.length == 3) {
            x = x.concat([undefined])                         // (if t c) => (if t c None)
        }
        require(x, x.length == 4);
        return x.map(expand);
    } else if (x[0] == _set) {
        require(x, x.length == 3);
        let vr = x[1];                                        // (set! non-var exp) => Error
        require(x, vr instanceof Symb, 'can set! only a symbol');
        return [_set, vr, expand(x[2])];
    } else if (x[0] == _define || x[0] == _definemacro) {
        require(x, x.length >= 3);
        let [_def, v, ...body] = x;
        if (Array.isArray(v) && v) {                          // (define (f args) body)
            let [f, ...args] = v;                             // => (define f (lambda (args) body))
            return expand([_def, f, [_lambda, args].concat(body)]);
        } else {
            require(x, x.length == 3);                        // (define non-var/list exp) => Error
            require(x, v instanceof Symb);
            let exp = expand(x[2]);
            if (_def == _definemacro) {
                require(x, toplevel, 'define-macro only allowed at top level');
                let proc = evalua(exp);
                require(x, typeof proc === 'function', 'macro must be a procedure');
                macro_table[v.toString()] = proc;             // (define-macro v proc)
                return undefined;                             // => None; add v:proc to macro_table
            }
            return [_define, v, exp];
        }
    } else if (x[0] == _begin) {
        if (x.length == 1) {                                  // (begin) => None
            return undefined;
        } else {
            return x.map(function (xi) {
                return expand(xi, toplevel);
            });
        }
    } else if (x[0] == _lambda) {                             // (lambda (x) e1 e2)
        require(x, x.length >= 3);                            // => (lambda (x) (begin e1 e2))
        let vrs = x[1];
        let body = x.slice(2);
        require(x, Array.isArray(vrs) && vrs.every(function (v) {
            return v instanceof Symb;
        }), 'illegal lambda argument list');
        let exp = body.length == 1 ? body[0] : [_begin].concat(body);
        return [_lambda, vrs, expand(exp)];
    } else if (x[0] == _quasiquote) {                         // `x => expand_quasiquote(x)
        require(x, x.length == 2);
        return expand_quasiquote(x[1]);
    } else if (x[0] instanceof Symb && x[0].toString() in macro_table) {      // (m arg...)
        return expand(macro_table[x[0].toString()](...x.slice(1)), toplevel);
    } else {                                                  //  => macroexpand if m isa macro
        return x.map(expand);                                 // (f arg...) => expand each
    }
}

/** Signal a syntax error if predicate is false. */
function require(x, predicate, msg = 'wrong length') {
    if (!predicate) {
        throw new SyntaxError(to_string(x) + ': ' + msg);
    }
}

/** Expand `x => 'x; `,x => x; `(,@x y) => (append x y)  */
function expand_quasiquote(x) {
    if (!is_pair(x)) {
        return [_quote, x];
    }
    require(x, x[0] !== _unquotesplicing, "can't splice here");
    if (x[0] != undefined && x[0] == _unquote) {
        require(x, x.length == 2);
        return x[1];
    } else if (x[0] != undefined && is_pair(x[0]) && x[0][0] == _unquotesplicing) {
        require(x[0], x[0].length == 2);
        return [_append, x[0][1], expand_quasiquote(x.slice(1))];
    } else {
        return [_cons, expand_quasiquote(x[0]), expand_quasiquote(x.slice(1))];
    }
}

/** Implement `unzip()` in JavaScript */
function unzip(doubleArr) {
    let arrSyb = [], arrParm = [];
    for (let bind of doubleArr) {
        let syb = bind[0];
        let parm = bind[1];
        arrSyb.push(syb);
        arrParm.push(parm);
    }
    return [arrSyb, arrParm];
}

function let_(...args) {
    let argsArr = args;
    let x = cons(_let, argsArr);
    require(x, argsArr.length > 1);
    let [bindings, ...body] = argsArr;
    require(x, bindings.every(function (b) {
        return Array.isArray(b) && b.length == 2 && b[0] != undefined && b[0] instanceof Symb
    }), 'illegal binding list');
    let unziped = unzip(bindings);
    let vrs = unziped[0];
    let vls = unziped[1];
    let res = [[_lambda, vrs].concat(body.map(expand))].concat(vls.map(expand));
    return res;
}

/*
load(
    `(begin
        (define-macro and (lambda (args)
            (if (null? args) #t
                (if (= (length args) 1) (car args)
                    \`(if ,(car args) (and ,@(cdr args)) #f)))))

         ;; More macros can also go here

        (define-macro mac1 (lambda (a b)
            \`(+ ,a (* ,b 3))))
        (- (+ 2 (* 8 2))
        (+ 1 (mac1 4 5)))
    )`
); // -2

load(`(if #t (+ 3 2) (- 4 2))`); // 5

load(`(display "Hi")`); // print(Hi)

load(`(cdr (list 3 6 8))`); // (6 8)

load(` `);

load(`(max 8 9 10 34)`); // 34

load(`(let ((a 1) (b 2)) (+ a b))`); // 3

load(`(+ 1 (call/cc
    (lambda (k)
      (+ 2 (k 3)))))`
); // 4
*/

// ------------------------- for `lispjs.html`

function getResult() {
    let textNode = document.getElementById('text');
    let butNode = document.getElementById('but');
    let resNode = document.getElementById('res');
    butNode.onclick = function () {
        let text = textNode.value;
        let res = load(text);
        resNode.value = res;
    };
}

getResult();
