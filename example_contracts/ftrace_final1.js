"use strict";

const parserHelpers = require('./parserHelpers')
const fs = require('fs')
const parser = require('solidity-parser-antlr')
const colors = require('colors')
const { linearize } = require('c3-linearization')
const treeify = require('treeify')


export function ftrace(functionId, accepted_visibility, files) {
/*
let libName;
  parser.visit(ast, {
    ImportDirective: function(node) {
      console.log(node.path)
      libName = node.path;
      files = files+libName;
    }
  })

console.log("file names="+files);
*/
/*
  var ast = parser.parse("import \"./abc.sol\";")
  assert.deepEqual(ast.children[0], {
    "type": "ImportDirective",
    "path": "./abc.sol",
    "unitAlias": null,
    "symbolAliases": null
 */

  //files = files+"example_contracts/SafeMath.sol";

  console.log("file names="+files);

  if (files.length === 0) {
    console.log('No files were specified for analysis in the arguments. Bailing...')
    return
  }

  const [contractToTraverse, functionToTraverse] = functionId.split('::', 2)

  if (contractToTraverse === undefined || functionToTraverse === undefined) {
    console.log('You did not provide the function identifier in the right format "CONTRACT::FUNCTION"'.yellow)
    return
  }

  if (accepted_visibility !== 'all' && accepted_visibility !== 'internal' && accepted_visibility !== 'external') {
    console.log(`The "${accepted_visibility}" type of call to traverse is not known [all|internal|external]`.yellow)
    return
  }

  let functionCallsTree = {}

  // initialize vars that persist over file parsing loops
  let userDefinedStateVars = {}
  let dependencies = {}
  let modifiers = {}
  let functionDecorators = {}

  let fileASTs = new Array()

  for (let file of files) {
  //  console.log("in loop file="+file);

    let content
    try {
      content = fs.readFileSync(file).toString('utf-8')
    } catch (e) {
      if (e.code === 'EISDIR') {
        console.error(`Skipping directory ${file}`)
        continue
      } else throw e;
    }

    const ast = parser.parse(content)
    console.log(ast);

    fileASTs.push(ast)

    let contractName = null
    let libraryName = null
    let cluster = null

    parser.visit(ast, {
      ContractDefinition(node) {
        contractName = node.name
                console.log("contract name1="+contractName)

        userDefinedStateVars[contractName] = {}

        dependencies[contractName] = node.baseContracts.map(spec =>
          spec.baseName.namePath
        )
      },


      ImportDirective: function(node) {
       // console.log(node.path)
       // let a="x";
       // a = a+" "+node.path
        //console.log("a="+a);
        const [conPath, conName] = file.split('/', 2)
        const [conName1, conext] = conName.split('.', 2)
///*
 //       console.log("conpath="+conPath)
 //       console.log("conname="+conName)
//        console.log("conname1="+conName1)
//        console.log("conext="+conext)
//*/

        console.log("contract name import="+conName1)

        const [libPath, libName] = node.path.split('/', 2)
        const [libName1, libext] = libName.split('.', 2)

        console.log("libname="+libName1)
        let lib = conPath+"/"+node.path
        console.log("lib="+lib);

        //dependencies[libName1] = libName1

/*
        if(contractName == conName1)
          console.log("yes")
*/
        let content1;
        try {
          content1 = fs.readFileSync(lib).toString('utf-8')
        } catch (e) {
          if (e.code === 'EISDIR') {
            console.error(`Skipping directory ${lib}`)
          } else throw e;
        }

        const ast1 = parser.parse(content1)
        console.log(ast1);

        fileASTs.push(ast1)
      },

/*
      ImportDirective: function(node) {
        var splitTest = function (str) {
         return str.split('\\').pop().split('/').pop();
        }

        let libraryName1 = splitTest("./SafeMath.sol")
          console.log(libraryName1)
          let x
          [libraryName,x] = libraryName1.split('.',2)
          //  const [contractToTraverse, functionToTraverse] = functionId.split('::', 2)
          //libraryName = nodePathh
          console.log(libraryName)
          console.log(libraryPath)
      },
*/
      UsingForDeclaration(node) {
        libraryName = node.libraryName
      },

      StateVariableDeclaration(node) {
        for (let variable of node.variables) {
          if (parserHelpers.isUserDefinedDeclaration(variable)) {
            userDefinedStateVars[contractName][variable.name] = variable.typeName.namePath
          }
        }
      }
    })
  }

  dependencies = linearize(dependencies, {reverse: true})

  for (let ast of fileASTs) {
    console.log("ast1=");
    console.log(ast);

    let contractName = null
    let libraryName = null
    let functionName = null
    let cluster = null

    let userDefinedLocalVars = {}
    let tempUserDefinedStateVars = {}
    let tempLibDefinedStateVars = {}


    parser.visit(ast, {
      ContractDefinition(node) {
        contractName = node.name

   //     console.log("contractName="+contractName)
   //     console.log("kind"+node.kind)

        if(node.kind == "library")
          dependencies[contractName] = node.name

        functionCallsTree[contractName] = {}
        modifiers[contractName] = {}

        console.log("anurag1,dependencies[contractName]="+dependencies[contractName])

        for (let dep of dependencies[contractName]) {
          console.log("dep="+dep)
          Object.assign(tempUserDefinedStateVars, userDefinedStateVars[dep])
        }

        Object.assign(tempUserDefinedStateVars, userDefinedStateVars[contractName])
      },

      'ContractDefinition:exit': function(node) {
        contractName = null
        tempUserDefinedStateVars = {}
      },

      ImportDirective: function(node) {
        contractName = node.libraryName
      },

      UsingForDeclaration(node) {
       libraryName = node.libraryName
      },

      FunctionDefinition(node) {
        if (node.isConstructor) {
          functionName = '<Constructor>'
        } else if (!node.name) {
          functionName = '<Fallback>'
        } else {
          functionName = node.name
        }


        let spec = ''
        if (node.visibility === 'public' || node.visibility === 'default') {
          spec += '[Pub] ❗️'
        } else if (node.visibility === 'external') {
          spec += '[Ext] ❗️'
        } else if (node.visibility === 'private') {
          spec += '[Priv] 🔐'
        } else if (node.visibility === 'internal') {
          spec += '[Int] 🔒'
        }

        let payable = ''
        if (node.stateMutability === 'payable') {
          payable = '💵'
        }

        let mutating = ''
        if (!node.stateMutability) {
          mutating = '🛑'
        }

        functionDecorators[functionName] = ` | ${spec}  ${mutating} ${payable}`

        functionCallsTree[contractName][functionName] = {}
        modifiers[contractName][functionName] = new Array()
      },

      'FunctionDefinition:exit': function(node) {
        functionName = null
        userDefinedLocalVars = {}
      },

      ModifierDefinition(node) {
        functionName = node.name

        functionCallsTree[contractName][functionName] = {}
      },

      'ModifierDefinition:exit': function(node) {
        functionName = null
      },

      ModifierInvocation(node) {
        modifiers[contractName][functionName].push(node.name)
      },

      ParameterList(node) {
        for (let parameter of node.parameters) {
          if (parserHelpers.isUserDefinedDeclaration(parameter)) {
            userDefinedLocalVars[parameter.name] = parameter.typeName.name
          } else if (parserHelpers.isAddressDeclaration(parameter)) {
            // starting name with  "#" because it's an illegal character for naming vars in Solidity
            userDefinedLocalVars[parameter.name] = `#address [${parameter.name}]`
          }
        }
      },

      VariableDeclaration(node) {
        if (functionName && parserHelpers.isUserDefinedDeclaration(node)) {
          userDefinedLocalVars[node.name] = node.typeName.namePath
        } else if (functionName && parserHelpers.isAddressDeclaration(node)) {
          // starting name with  "#" because it's an illegal character for naming vars in Solidity
          userDefinedLocalVars[node.name] = `#address [${node.name}]`
        }
      },

      FunctionCall(node) {
        if (!functionName) {
          // this is a function call outside of functions and modifiers, ignore if exists
          return
        }

        const expr = node.expression

        let name
        let localContractName
        let visibility

        // The following block is a nested switch statement for creation of the call tree
        // START BLOCK
        if (parserHelpers.isRegularFunctionCall(node)) {
          name = expr.name
          localContractName = contractName
          visibility = 'internal'
        } else if (parserHelpers.isMemberAccess(node)) {
          let object

          visibility = 'external'

          name = expr.memberName

          if (expr.expression.hasOwnProperty('name')) {
            object = expr.expression.name

          // checking if it is a member of `address` and pass along it's contents
          } else if (parserHelpers.isMemberAccessOfAddress(node)) {
            if(expr.expression.arguments[0].hasOwnProperty('name')) {
              object = expr.expression.arguments[0].name
            } else {
              object = JSON.stringify(expr.expression.arguments)
            }

          // checking if it is a typecasting to a user-defined contract type
          } else if (parserHelpers.isAContractTypecast(node)) {

            if(expr.expression.expression.hasOwnProperty('name')) {
              object = expr.expression.expression.name
            } else {
              return
            }
          } else {
            return
          }

          // Special keywords cases: this, super
          if (object === 'this') {
            localContractName = contractName
                    console.log("contract name1="+localContractName);
          } else if (object === 'super') {
            localContractName = dependencies[contractName][1]
                    console.log("contract name2="+localContractName);
          // the next two cases are checking if any user defined contract variable members were accessed
          } else if (tempUserDefinedStateVars[object] !== undefined) {
            localContractName = tempUserDefinedStateVars[object]
                    console.log("contract name3="+localContractName);
          } else if (userDefinedLocalVars[object] !== undefined) {
            localContractName = userDefinedLocalVars[object]
                    console.log("contract name4="+localContractName);
          } else if (libraryName !== undefined) {
            localContractName = libraryName
           //     console.log("contract name5="+localContractName);
          } else {
            localContractName = object
                    console.log("contract name6="+localContractName);
          }
        } else {
          return
        }
        // END BLOCK

        if(!functionCallsTree[contractName][functionName].hasOwnProperty(name)) {
          functionCallsTree[contractName][functionName][name] = {
            contract: localContractName,
            numberOfCalls: 1,
            visibility: visibility
          }
        } else {
          functionCallsTree[contractName][functionName][name].numberOfCalls++
        }
      }
    })
  }
  // END of file traversing

  let touched = {}
  let callTree = {}

  if(!functionCallsTree.hasOwnProperty(contractToTraverse)) {
    console.log(`The ${contractToTraverse} contract is not present in the codebase.`.yellow)
    return
  } else if (!functionCallsTree[contractToTraverse].hasOwnProperty(functionToTraverse)) {
    console.log(`The ${functionToTraverse} function is not present in ${contractToTraverse}.`.yellow)
    return
  }

  const seedKeyString = `${contractToTraverse}::${functionToTraverse}`.green
  touched[seedKeyString] = true
  callTree[seedKeyString] = {}

  function modifierCalls(modifierName, contractName) {
    if (dependencies.hasOwnProperty(contractName)) {
      for (let dep of dependencies[contractName]) {
        if (functionCallsTree[dep].hasOwnProperty(modifierName)) {
          return functionCallsTree[dep][modifierName]
        }
      }
    }

    return functionCallsTree[contractName].hasOwnProperty(modifierName) ?
            functionCallsTree[contractName][modifierName] : {}
  }

  let queue = new Array()

  // Function to recursively generate the tree to show in the console
  function constructCallTree(reduceJobContractName, reduceJobFunctionName, parentObject) {
    let tempIterable

  //  console.log("inside constructCallTree,reduceJobContractName="+reduceJobContractName);
  //  console.log("inside constructCallTree,reduceJobFunctionName="+reduceJobFunctionName);
    //if(reduceJobContractName === libraryName)
      //functionCallsTree[reduceJobContractName][reduceJobFunctionName] = {}
 //   console.log(functionCallsTree[reduceJobContractName][reduceJobFunctionName]);
 //   console.log("inside constructCallTree-0");
    //console.log(parentObject);

    if (functionCallsTree[reduceJobContractName][reduceJobFunctionName] === undefined) {
      return
    }

  //  console.log("inside constructCallTree-1");

    tempIterable = functionCallsTree[reduceJobContractName][reduceJobFunctionName]

    for (const modifier of modifiers[reduceJobContractName][reduceJobFunctionName]) {
      Object.assign(tempIterable, modifierCalls(modifier, reduceJobContractName))
    }
    //console.log("inside constructCallTree-1-1");
    Object.entries(tempIterable).forEach(([functionCallName, functionCallObject]) => {

     //console.log("accepted_visibility="+accepted_visibility);
     //console.log(functionCallObject);
     //console.log("functionCallObject.visibility="+functionCallObject.visibility);

      if (
        functionCallName !== 'undefined' && (
          accepted_visibility == 'all' ||
          functionCallObject.visibility == accepted_visibility
        )
      ) {
        let keyString = `${functionCallObject.contract}::${functionCallName}`

        keyString += functionDecorators[functionCallName] === undefined ? '' : functionDecorators[functionCallName]

        keyString = functionCallObject.visibility === 'external' && accepted_visibility !== 'external'
                    ? keyString.yellow : keyString

    //console.log("inside constructCallTree-2");

        if(touched[keyString] === undefined) {
      //    console.log("inside constructCallTree-3");
          parentObject[keyString] = {}
          touched[keyString] = true

          // Test if the call is really to a contract or rather an address variable member access
          // If it is not a contract we should stop here
          if(functionCallObject.contract.substring(0,8) !== '#address') {
        //    console.log("inside constructCallTree-3-3,functionCallObject.contract="+functionCallObject.contract);
          //  console.log("inside constructCallTree-3-3,functionCallName="+functionCallName);
           // console.log(parentObject[keyString]);
            constructCallTree(functionCallObject.contract, functionCallName, parentObject[keyString])
          }
        } else {
          parentObject[keyString] = Object.keys(functionCallsTree[functionCallObject.contract][functionCallName]).length === 0 ?
                                    {} :
                                    '..[Repeated Ref]..'.red
          //console.log("inside constructCallTree-4-0");
          //console.log(parentObject[keyString]);
        }
      }
            //    console.log("inside constructCallTree-4");
    })
  }

//console.log("before constructCallTree");
  // Call with seed
  constructCallTree(contractToTraverse, functionToTraverse, callTree[seedKeyString])
//console.log("after constructCallTree");
  console.log(treeify.asTree(callTree, true))
}
