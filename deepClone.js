function deepClone(obj, hash = new WeakMap()) {
  // 处理基本类型和函数
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  // 处理循环引用
  if (hash.has(obj)) {
    return hash.get(obj);
  }

  let cloneObj;

  // 处理日期
  if (obj instanceof Date) {
    cloneObj = new Date(obj);
    hash.set(obj, cloneObj);
    return cloneObj;
  }

  // 处理正则表达式
  if (obj instanceof RegExp) {
    cloneObj = new RegExp(obj.source, obj.flags);
    hash.set(obj, cloneObj);
    return cloneObj;
  }

  // 处理Map
  if (obj instanceof Map) {
    cloneObj = new Map();
    hash.set(obj, cloneObj);
    obj.forEach((value, key) => {
      cloneObj.set(deepClone(key, hash), deepClone(value, hash));
    });
    return cloneObj;
  }

  // 处理Set
  if (obj instanceof Set) {
    cloneObj = new Set();
    hash.set(obj, cloneObj);
    obj.forEach(value => {
      cloneObj.add(deepClone(value, hash));
    });
    return cloneObj;
  }

  // 处理Symbol
  if (typeof obj === 'symbol') {
    return Symbol(obj.description);
  }

  // 处理对象和数组
  cloneObj = Array.isArray(obj) ? [] : {};
  hash.set(obj, cloneObj);

  // 递归拷贝属性
  Reflect.ownKeys(obj).forEach(key => {
    cloneObj[key] = deepClone(obj[key], hash);
  });

  return cloneObj;
}

// 测试用例
const testData = {
  // 基本类型
  number: 42,
  string: 'hello',
  boolean: true,
  null: null,
  undefined: undefined,

  // 对象和数组
  object: { a: 1, b: { c: 2 } },
  array: [1, 2, { d: 3 }],

  // 内置对象
  date: new Date('2023-01-01'),
  regexp: /test/g,
  map: new Map([['key1', 'value1'], ['key2', 'value2']]),
  set: new Set([1, 2, 3]),

  // Symbol
  symbol: Symbol('test'),

  // 函数
  function: function(x) { return x * 2; },

  // 循环引用
  self: null
};

// 创建循环引用
testData.self = testData;

// 执行深拷贝
const clonedData = deepClone(testData);

// 验证结果
console.log(clonedData !== testData); // true
console.log(clonedData.object !== testData.object); // true
console.log(clonedData.array !== testData.array); // true
console.log(clonedData.date instanceof Date); // true
console.log(clonedData.regexp instanceof RegExp); // true
console.log(clonedData.map instanceof Map); // true
console.log(clonedData.set instanceof Set); // true
console.log(clonedData.self === clonedData); // true (循环引用)
console.log(clonedData.function(5)); // 10