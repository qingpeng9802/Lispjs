# Lispjs

A Lisp (Scheme) Interpreter in JavaScript (ES6) referring to `lisp.py` at [(An ((Even Better) Lisp) Interpreter (in Python))](http://norvig.com/lispy2.html)  

## Background

This project is inspired by Peter Norvig's essay: [(An ((Even Better) Lisp) Interpreter (in Python))](http://norvig.com/lispy2.html). The author implemented some Scheme syntax in the interpreter, and this essay discussed the implementation of a Lisp(Scheme) Interpreter in Python.  

## Usage

### In browser
1. Open `lispjs.html` in a browser. The upper text box is used to input Scheme code.  
2. After inputting Scheme code, click `Run` button. Then, the evaluation result of Scheme code will be shown in the lower text box.  

### In source code with console
Example:
```javascript
let res = load(`(+ 1 (call/cc (lambda (k) (+ 2 (k 3)))))`);
console.log(res); // expected output: 4
```
The result will printed in the console.  

## Features
* Pure JavaScript (ES6); no dependency lib needed; easy to extend and debug  
* Follow `lisp.py`'s original style and design as much as possible (special change is commented with `// Notice: `)  
* Easy to read and understand with original `lisp.py`  

## Acknowledgment
Good essay: [(An ((Even Better) Lisp) Interpreter (in Python))](http://norvig.com/lispy2.html) by Peter Norvig  
John Hardy's [lispy2.js](https://github.com/jhlagado/lispy2js)  
