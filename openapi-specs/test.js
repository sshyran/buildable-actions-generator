const fs = require("fs")
const { cloneDeep, isObject, isObjectLike, get, set } = require("lodash")
const pdspec = JSON.parse(fs.readFileSync("openapi-specs/pagerduty-openapi.json"))

let paths = pdspec.paths

//do stuff

const walk = (subject, apply) => {
  const clonedSubject = cloneDeep(subject);
  const seen = new Set(); //handle circular references

  const _walk = (node) => {
    if (seen.has(node)) {
      return node; //do nothing
    }
    if (isObjectLike(node)) {
      //handle primitives
      seen.add(node);
    }

    const result = apply(node, clonedSubject);
    node = result === undefined ? node : result; //allow for nulls to be set

    if (Array.isArray(node)) {
      node = node.map((item) => _walk(item));
    } else if (node instanceof Set) {
      const newSet = new Set();
      node.forEach((item) => {
        newSet.add(_walk(item));
      });

      node = newSet;
    } else if (node instanceof Map) {
      node.forEach((value, key) => {
        node.set(key, _walk(value));
      });
    } else if (node && typeof node === "object") {
      //maintain instance integrity, doing { ...newObj } causes loss of instance type
      Object.keys(node).map((key) => {
        node[key] = _walk(node[key]);
      });
    }

    return node;
  };

  return _walk(clonedSubject);
};

const fixRequired = (
  object,
) => {
  const apply = (node) => {
    if (isObject(node)) {
      if (node.description && typeof node.description === "string" && node.description.includes("(Required)")) {
        node.required = true
      }
    }

    if(isObject(node) && !!get(node, "requestBody.content.application/json")) {
      set(node, "requestBody.required", true)
    }
  };

  return walk(object, apply);
};

pdspec.paths = fixRequired(paths)

fs.writeFileSync("./openapi-specs/pagerduty-openapi.json", JSON.stringify(pdspec))