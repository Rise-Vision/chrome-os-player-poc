//     Underscore.js 1.8.3
//     http://underscorejs.org
//     (c) 2009-2015 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind,
    nativeCreate       = Object.create;

  // Naked function reference for surrogate-prototype-swapping.
  var Ctor = function(){};

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.8.3';

  // Internal function that returns an efficient (for current engines) version
  // of the passed-in callback, to be repeatedly applied in other Underscore
  // functions.
  var optimizeCb = function(func, context, argCount) {
    if (context === void 0) return func;
    switch (argCount == null ? 3 : argCount) {
      case 1: return function(value) {
        return func.call(context, value);
      };
      case 2: return function(value, other) {
        return func.call(context, value, other);
      };
      case 3: return function(value, index, collection) {
        return func.call(context, value, index, collection);
      };
      case 4: return function(accumulator, value, index, collection) {
        return func.call(context, accumulator, value, index, collection);
      };
    }
    return function() {
      return func.apply(context, arguments);
    };
  };

  // A mostly-internal function to generate callbacks that can be applied
  // to each element in a collection, returning the desired result — either
  // identity, an arbitrary callback, a property matcher, or a property accessor.
  var cb = function(value, context, argCount) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return optimizeCb(value, context, argCount);
    if (_.isObject(value)) return _.matcher(value);
    return _.property(value);
  };
  _.iteratee = function(value, context) {
    return cb(value, context, Infinity);
  };

  // An internal function for creating assigner functions.
  var createAssigner = function(keysFunc, undefinedOnly) {
    return function(obj) {
      var length = arguments.length;
      if (length < 2 || obj == null) return obj;
      for (var index = 1; index < length; index++) {
        var source = arguments[index],
            keys = keysFunc(source),
            l = keys.length;
        for (var i = 0; i < l; i++) {
          var key = keys[i];
          if (!undefinedOnly || obj[key] === void 0) obj[key] = source[key];
        }
      }
      return obj;
    };
  };

  // An internal function for creating a new object that inherits from another.
  var baseCreate = function(prototype) {
    if (!_.isObject(prototype)) return {};
    if (nativeCreate) return nativeCreate(prototype);
    Ctor.prototype = prototype;
    var result = new Ctor;
    Ctor.prototype = null;
    return result;
  };

  var property = function(key) {
    return function(obj) {
      return obj == null ? void 0 : obj[key];
    };
  };

  // Helper for collection methods to determine whether a collection
  // should be iterated as an array or as an object
  // Related: http://people.mozilla.org/~jorendorff/es6-draft.html#sec-tolength
  // Avoids a very nasty iOS 8 JIT bug on ARM-64. #2094
  var MAX_ARRAY_INDEX = Math.pow(2, 53) - 1;
  var getLength = property('length');
  var isArrayLike = function(collection) {
    var length = getLength(collection);
    return typeof length == 'number' && length >= 0 && length <= MAX_ARRAY_INDEX;
  };

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles raw objects in addition to array-likes. Treats all
  // sparse array-likes as if they were dense.
  _.each = _.forEach = function(obj, iteratee, context) {
    iteratee = optimizeCb(iteratee, context);
    var i, length;
    if (isArrayLike(obj)) {
      for (i = 0, length = obj.length; i < length; i++) {
        iteratee(obj[i], i, obj);
      }
    } else {
      var keys = _.keys(obj);
      for (i = 0, length = keys.length; i < length; i++) {
        iteratee(obj[keys[i]], keys[i], obj);
      }
    }
    return obj;
  };

  // Return the results of applying the iteratee to each element.
  _.map = _.collect = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length,
        results = Array(length);
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      results[index] = iteratee(obj[currentKey], currentKey, obj);
    }
    return results;
  };

  // Create a reducing function iterating left or right.
  function createReduce(dir) {
    // Optimized iterator function as using arguments.length
    // in the main function will deoptimize the, see #1991.
    function iterator(obj, iteratee, memo, keys, index, length) {
      for (; index >= 0 && index < length; index += dir) {
        var currentKey = keys ? keys[index] : index;
        memo = iteratee(memo, obj[currentKey], currentKey, obj);
      }
      return memo;
    }

    return function(obj, iteratee, memo, context) {
      iteratee = optimizeCb(iteratee, context, 4);
      var keys = !isArrayLike(obj) && _.keys(obj),
          length = (keys || obj).length,
          index = dir > 0 ? 0 : length - 1;
      // Determine the initial value if none is provided.
      if (arguments.length < 3) {
        memo = obj[keys ? keys[index] : index];
        index += dir;
      }
      return iterator(obj, iteratee, memo, keys, index, length);
    };
  }

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`.
  _.reduce = _.foldl = _.inject = createReduce(1);

  // The right-associative version of reduce, also known as `foldr`.
  _.reduceRight = _.foldr = createReduce(-1);

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var key;
    if (isArrayLike(obj)) {
      key = _.findIndex(obj, predicate, context);
    } else {
      key = _.findKey(obj, predicate, context);
    }
    if (key !== void 0 && key !== -1) return obj[key];
  };

  // Return all the elements that pass a truth test.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    predicate = cb(predicate, context);
    _.each(obj, function(value, index, list) {
      if (predicate(value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, _.negate(cb(predicate)), context);
  };

  // Determine whether all of the elements match a truth test.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (!predicate(obj[currentKey], currentKey, obj)) return false;
    }
    return true;
  };

  // Determine if at least one element in the object matches a truth test.
  // Aliased as `any`.
  _.some = _.any = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = !isArrayLike(obj) && _.keys(obj),
        length = (keys || obj).length;
    for (var index = 0; index < length; index++) {
      var currentKey = keys ? keys[index] : index;
      if (predicate(obj[currentKey], currentKey, obj)) return true;
    }
    return false;
  };

  // Determine if the array or object contains a given item (using `===`).
  // Aliased as `includes` and `include`.
  _.contains = _.includes = _.include = function(obj, item, fromIndex, guard) {
    if (!isArrayLike(obj)) obj = _.values(obj);
    if (typeof fromIndex != 'number' || guard) fromIndex = 0;
    return _.indexOf(obj, item, fromIndex) >= 0;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      var func = isFunc ? method : value[method];
      return func == null ? func : func.apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matcher(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matcher(attrs));
  };

  // Return the maximum element (or element-based computation).
  _.max = function(obj, iteratee, context) {
    var result = -Infinity, lastComputed = -Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value > result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed > lastComputed || computed === -Infinity && result === -Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iteratee, context) {
    var result = Infinity, lastComputed = Infinity,
        value, computed;
    if (iteratee == null && obj != null) {
      obj = isArrayLike(obj) ? obj : _.values(obj);
      for (var i = 0, length = obj.length; i < length; i++) {
        value = obj[i];
        if (value < result) {
          result = value;
        }
      }
    } else {
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index, list) {
        computed = iteratee(value, index, list);
        if (computed < lastComputed || computed === Infinity && result === Infinity) {
          result = value;
          lastComputed = computed;
        }
      });
    }
    return result;
  };

  // Shuffle a collection, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var set = isArrayLike(obj) ? obj : _.values(obj);
    var length = set.length;
    var shuffled = Array(length);
    for (var index = 0, rand; index < length; index++) {
      rand = _.random(0, index);
      if (rand !== index) shuffled[index] = shuffled[rand];
      shuffled[rand] = set[index];
    }
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (!isArrayLike(obj)) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // Sort the object's values by a criterion produced by an iteratee.
  _.sortBy = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iteratee(value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iteratee, context) {
      var result = {};
      iteratee = cb(iteratee, context);
      _.each(obj, function(value, index) {
        var key = iteratee(value, index, obj);
        behavior(result, value, key);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key].push(value); else result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, value, key) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, value, key) {
    if (_.has(result, key)) result[key]++; else result[key] = 1;
  });

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (isArrayLike(obj)) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return isArrayLike(obj) ? obj.length : _.keys(obj).length;
  };

  // Split a collection into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var pass = [], fail = [];
    _.each(obj, function(value, key, obj) {
      (predicate(value, key, obj) ? pass : fail).push(value);
    });
    return [pass, fail];
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[0];
    return _.initial(array, array.length - n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, Math.max(0, array.length - (n == null || guard ? 1 : n)));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if (n == null || guard) return array[array.length - 1];
    return _.rest(array, Math.max(0, array.length - n));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, n == null || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, strict, startIndex) {
    var output = [], idx = 0;
    for (var i = startIndex || 0, length = getLength(input); i < length; i++) {
      var value = input[i];
      if (isArrayLike(value) && (_.isArray(value) || _.isArguments(value))) {
        //flatten current level of array or arguments object
        if (!shallow) value = flatten(value, shallow, strict);
        var j = 0, len = value.length;
        output.length += len;
        while (j < len) {
          output[idx++] = value[j++];
        }
      } else if (!strict) {
        output[idx++] = value;
      }
    }
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, false);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iteratee, context) {
    if (!_.isBoolean(isSorted)) {
      context = iteratee;
      iteratee = isSorted;
      isSorted = false;
    }
    if (iteratee != null) iteratee = cb(iteratee, context);
    var result = [];
    var seen = [];
    for (var i = 0, length = getLength(array); i < length; i++) {
      var value = array[i],
          computed = iteratee ? iteratee(value, i, array) : value;
      if (isSorted) {
        if (!i || seen !== computed) result.push(value);
        seen = computed;
      } else if (iteratee) {
        if (!_.contains(seen, computed)) {
          seen.push(computed);
          result.push(value);
        }
      } else if (!_.contains(result, value)) {
        result.push(value);
      }
    }
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(flatten(arguments, true, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var result = [];
    var argsLength = arguments.length;
    for (var i = 0, length = getLength(array); i < length; i++) {
      var item = array[i];
      if (_.contains(result, item)) continue;
      for (var j = 1; j < argsLength; j++) {
        if (!_.contains(arguments[j], item)) break;
      }
      if (j === argsLength) result.push(item);
    }
    return result;
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = flatten(arguments, true, true, 1);
    return _.filter(array, function(value){
      return !_.contains(rest, value);
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    return _.unzip(arguments);
  };

  // Complement of _.zip. Unzip accepts an array of arrays and groups
  // each array's elements on shared indices
  _.unzip = function(array) {
    var length = array && _.max(array, getLength).length || 0;
    var result = Array(length);

    for (var index = 0; index < length; index++) {
      result[index] = _.pluck(array, index);
    }
    return result;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    var result = {};
    for (var i = 0, length = getLength(list); i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // Generator function to create the findIndex and findLastIndex functions
  function createPredicateIndexFinder(dir) {
    return function(array, predicate, context) {
      predicate = cb(predicate, context);
      var length = getLength(array);
      var index = dir > 0 ? 0 : length - 1;
      for (; index >= 0 && index < length; index += dir) {
        if (predicate(array[index], index, array)) return index;
      }
      return -1;
    };
  }

  // Returns the first index on an array-like that passes a predicate test
  _.findIndex = createPredicateIndexFinder(1);
  _.findLastIndex = createPredicateIndexFinder(-1);

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iteratee, context) {
    iteratee = cb(iteratee, context, 1);
    var value = iteratee(obj);
    var low = 0, high = getLength(array);
    while (low < high) {
      var mid = Math.floor((low + high) / 2);
      if (iteratee(array[mid]) < value) low = mid + 1; else high = mid;
    }
    return low;
  };

  // Generator function to create the indexOf and lastIndexOf functions
  function createIndexFinder(dir, predicateFind, sortedIndex) {
    return function(array, item, idx) {
      var i = 0, length = getLength(array);
      if (typeof idx == 'number') {
        if (dir > 0) {
            i = idx >= 0 ? idx : Math.max(idx + length, i);
        } else {
            length = idx >= 0 ? Math.min(idx + 1, length) : idx + length + 1;
        }
      } else if (sortedIndex && idx && length) {
        idx = sortedIndex(array, item);
        return array[idx] === item ? idx : -1;
      }
      if (item !== item) {
        idx = predicateFind(slice.call(array, i, length), _.isNaN);
        return idx >= 0 ? idx + i : -1;
      }
      for (idx = dir > 0 ? i : length - 1; idx >= 0 && idx < length; idx += dir) {
        if (array[idx] === item) return idx;
      }
      return -1;
    };
  }

  // Return the position of the first occurrence of an item in an array,
  // or -1 if the item is not included in the array.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = createIndexFinder(1, _.findIndex, _.sortedIndex);
  _.lastIndexOf = createIndexFinder(-1, _.findLastIndex);

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (stop == null) {
      stop = start || 0;
      start = 0;
    }
    step = step || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var range = Array(length);

    for (var idx = 0; idx < length; idx++, start += step) {
      range[idx] = start;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Determines whether to execute a function as a constructor
  // or a normal function with the provided arguments
  var executeBound = function(sourceFunc, boundFunc, context, callingContext, args) {
    if (!(callingContext instanceof boundFunc)) return sourceFunc.apply(context, args);
    var self = baseCreate(sourceFunc.prototype);
    var result = sourceFunc.apply(self, args);
    if (_.isObject(result)) return result;
    return self;
  };

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError('Bind must be called on a function');
    var args = slice.call(arguments, 2);
    var bound = function() {
      return executeBound(func, bound, context, this, args.concat(slice.call(arguments)));
    };
    return bound;
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    var bound = function() {
      var position = 0, length = boundArgs.length;
      var args = Array(length);
      for (var i = 0; i < length; i++) {
        args[i] = boundArgs[i] === _ ? arguments[position++] : boundArgs[i];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return executeBound(func, bound, this, this, args);
    };
    return bound;
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var i, length = arguments.length, key;
    if (length <= 1) throw new Error('bindAll must be passed function names');
    for (i = 1; i < length; i++) {
      key = arguments[i];
      obj[key] = _.bind(obj[key], obj);
    }
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memoize = function(key) {
      var cache = memoize.cache;
      var address = '' + (hasher ? hasher.apply(this, arguments) : key);
      if (!_.has(cache, address)) cache[address] = func.apply(this, arguments);
      return cache[address];
    };
    memoize.cache = {};
    return memoize;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){
      return func.apply(null, args);
    }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = _.partial(_.delay, _, 1);

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    if (!options) options = {};
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0 || remaining > wait) {
        if (timeout) {
          clearTimeout(timeout);
          timeout = null;
        }
        previous = now;
        result = func.apply(context, args);
        if (!timeout) context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;

      if (last < wait && last >= 0) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          if (!timeout) context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) timeout = setTimeout(later, wait);
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a negated version of the passed-in predicate.
  _.negate = function(predicate) {
    return function() {
      return !predicate.apply(this, arguments);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var args = arguments;
    var start = args.length - 1;
    return function() {
      var i = start;
      var result = args[start].apply(this, arguments);
      while (i--) result = args[i].call(this, result);
      return result;
    };
  };

  // Returns a function that will only be executed on and after the Nth call.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Returns a function that will only be executed up to (but not including) the Nth call.
  _.before = function(times, func) {
    var memo;
    return function() {
      if (--times > 0) {
        memo = func.apply(this, arguments);
      }
      if (times <= 1) func = null;
      return memo;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = _.partial(_.before, 2);

  // Object Functions
  // ----------------

  // Keys in IE < 9 that won't be iterated by `for key in ...` and thus missed.
  var hasEnumBug = !{toString: null}.propertyIsEnumerable('toString');
  var nonEnumerableProps = ['valueOf', 'isPrototypeOf', 'toString',
                      'propertyIsEnumerable', 'hasOwnProperty', 'toLocaleString'];

  function collectNonEnumProps(obj, keys) {
    var nonEnumIdx = nonEnumerableProps.length;
    var constructor = obj.constructor;
    var proto = (_.isFunction(constructor) && constructor.prototype) || ObjProto;

    // Constructor is a special case.
    var prop = 'constructor';
    if (_.has(obj, prop) && !_.contains(keys, prop)) keys.push(prop);

    while (nonEnumIdx--) {
      prop = nonEnumerableProps[nonEnumIdx];
      if (prop in obj && obj[prop] !== proto[prop] && !_.contains(keys, prop)) {
        keys.push(prop);
      }
    }
  }

  // Retrieve the names of an object's own properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve all the property names of an object.
  _.allKeys = function(obj) {
    if (!_.isObject(obj)) return [];
    var keys = [];
    for (var key in obj) keys.push(key);
    // Ahem, IE < 9.
    if (hasEnumBug) collectNonEnumProps(obj, keys);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Returns the results of applying the iteratee to each element of the object
  // In contrast to _.map it returns an object
  _.mapObject = function(obj, iteratee, context) {
    iteratee = cb(iteratee, context);
    var keys =  _.keys(obj),
          length = keys.length,
          results = {},
          currentKey;
      for (var index = 0; index < length; index++) {
        currentKey = keys[index];
        results[currentKey] = iteratee(obj[currentKey], currentKey, obj);
      }
      return results;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = createAssigner(_.allKeys);

  // Assigns a given object with all the own properties in the passed-in object(s)
  // (https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object/assign)
  _.extendOwn = _.assign = createAssigner(_.keys);

  // Returns the first key on an object that passes a predicate test
  _.findKey = function(obj, predicate, context) {
    predicate = cb(predicate, context);
    var keys = _.keys(obj), key;
    for (var i = 0, length = keys.length; i < length; i++) {
      key = keys[i];
      if (predicate(obj[key], key, obj)) return key;
    }
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(object, oiteratee, context) {
    var result = {}, obj = object, iteratee, keys;
    if (obj == null) return result;
    if (_.isFunction(oiteratee)) {
      keys = _.allKeys(obj);
      iteratee = optimizeCb(oiteratee, context);
    } else {
      keys = flatten(arguments, false, false, 1);
      iteratee = function(value, key, obj) { return key in obj; };
      obj = Object(obj);
    }
    for (var i = 0, length = keys.length; i < length; i++) {
      var key = keys[i];
      var value = obj[key];
      if (iteratee(value, key, obj)) result[key] = value;
    }
    return result;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj, iteratee, context) {
    if (_.isFunction(iteratee)) {
      iteratee = _.negate(iteratee);
    } else {
      var keys = _.map(flatten(arguments, false, false, 1), String);
      iteratee = function(value, key) {
        return !_.contains(keys, key);
      };
    }
    return _.pick(obj, iteratee, context);
  };

  // Fill in a given object with default properties.
  _.defaults = createAssigner(_.allKeys, true);

  // Creates an object that inherits from the given prototype object.
  // If additional properties are provided then they will be added to the
  // created object.
  _.create = function(prototype, props) {
    var result = baseCreate(prototype);
    if (props) _.extendOwn(result, props);
    return result;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Returns whether an object has a given set of `key:value` pairs.
  _.isMatch = function(object, attrs) {
    var keys = _.keys(attrs), length = keys.length;
    if (object == null) return !length;
    var obj = Object(object);
    for (var i = 0; i < length; i++) {
      var key = keys[i];
      if (attrs[key] !== obj[key] || !(key in obj)) return false;
    }
    return true;
  };


  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a === 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className !== toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, regular expressions, dates, and booleans are compared by value.
      case '[object RegExp]':
      // RegExps are coerced to strings for comparison (Note: '' + /a/i === '/a/i')
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return '' + a === '' + b;
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive.
        // Object(NaN) is equivalent to NaN
        if (+a !== +a) return +b !== +b;
        // An `egal` comparison is performed for other numeric values.
        return +a === 0 ? 1 / +a === 1 / b : +a === +b;
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a === +b;
    }

    var areArrays = className === '[object Array]';
    if (!areArrays) {
      if (typeof a != 'object' || typeof b != 'object') return false;

      // Objects with different constructors are not equivalent, but `Object`s or `Array`s
      // from different frames are.
      var aCtor = a.constructor, bCtor = b.constructor;
      if (aCtor !== bCtor && !(_.isFunction(aCtor) && aCtor instanceof aCtor &&
                               _.isFunction(bCtor) && bCtor instanceof bCtor)
                          && ('constructor' in a && 'constructor' in b)) {
        return false;
      }
    }
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.

    // Initializing stack of traversed objects.
    // It's done here since we only need them for objects and arrays comparison.
    aStack = aStack || [];
    bStack = bStack || [];
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] === a) return bStack[length] === b;
    }

    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);

    // Recursively compare objects and arrays.
    if (areArrays) {
      // Compare array lengths to determine if a deep comparison is necessary.
      length = a.length;
      if (length !== b.length) return false;
      // Deep compare the contents, ignoring non-numeric properties.
      while (length--) {
        if (!eq(a[length], b[length], aStack, bStack)) return false;
      }
    } else {
      // Deep compare objects.
      var keys = _.keys(a), key;
      length = keys.length;
      // Ensure that both objects contain the same number of properties before comparing deep equality.
      if (_.keys(b).length !== length) return false;
      while (length--) {
        // Deep compare each member
        key = keys[length];
        if (!(_.has(b, key) && eq(a[key], b[key], aStack, bStack))) return false;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return true;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (isArrayLike(obj) && (_.isArray(obj) || _.isString(obj) || _.isArguments(obj))) return obj.length === 0;
    return _.keys(obj).length === 0;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) === '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    var type = typeof obj;
    return type === 'function' || type === 'object' && !!obj;
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp, isError.
  _.each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp', 'Error'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) === '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE < 9), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return _.has(obj, 'callee');
    };
  }

  // Optimize `isFunction` if appropriate. Work around some typeof bugs in old v8,
  // IE 11 (#1621), and in Safari 8 (#1929).
  if (typeof /./ != 'function' && typeof Int8Array != 'object') {
    _.isFunction = function(obj) {
      return typeof obj == 'function' || false;
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj !== +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) === '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return obj != null && hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iteratees.
  _.identity = function(value) {
    return value;
  };

  // Predicate-generating functions. Often useful outside of Underscore.
  _.constant = function(value) {
    return function() {
      return value;
    };
  };

  _.noop = function(){};

  _.property = property;

  // Generates a function for a given object that returns a given property.
  _.propertyOf = function(obj) {
    return obj == null ? function(){} : function(key) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of
  // `key:value` pairs.
  _.matcher = _.matches = function(attrs) {
    attrs = _.extendOwn({}, attrs);
    return function(obj) {
      return _.isMatch(obj, attrs);
    };
  };

  // Run a function **n** times.
  _.times = function(n, iteratee, context) {
    var accum = Array(Math.max(0, n));
    iteratee = optimizeCb(iteratee, context, 1);
    for (var i = 0; i < n; i++) accum[i] = iteratee(i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() {
    return new Date().getTime();
  };

   // List of HTML entities for escaping.
  var escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '`': '&#x60;'
  };
  var unescapeMap = _.invert(escapeMap);

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  var createEscaper = function(map) {
    var escaper = function(match) {
      return map[match];
    };
    // Regexes for identifying a key that needs to be escaped
    var source = '(?:' + _.keys(map).join('|') + ')';
    var testRegexp = RegExp(source);
    var replaceRegexp = RegExp(source, 'g');
    return function(string) {
      string = string == null ? '' : '' + string;
      return testRegexp.test(string) ? string.replace(replaceRegexp, escaper) : string;
    };
  };
  _.escape = createEscaper(escapeMap);
  _.unescape = createEscaper(unescapeMap);

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property, fallback) {
    var value = object == null ? void 0 : object[property];
    if (value === void 0) {
      value = fallback;
    }
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\u2028|\u2029/g;

  var escapeChar = function(match) {
    return '\\' + escapes[match];
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  // NB: `oldSettings` only exists for backwards compatibility.
  _.template = function(text, settings, oldSettings) {
    if (!settings && oldSettings) settings = oldSettings;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset).replace(escaper, escapeChar);
      index = offset + match.length;

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      } else if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      } else if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }

      // Adobe VMs need the match returned to produce the correct offest.
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + 'return __p;\n';

    try {
      var render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled source as a convenience for precompilation.
    var argument = settings.variable || 'obj';
    template.source = 'function(' + argument + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function. Start chaining a wrapped Underscore object.
  _.chain = function(obj) {
    var instance = _(obj);
    instance._chain = true;
    return instance;
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(instance, obj) {
    return instance._chain ? _(obj).chain() : obj;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    _.each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result(this, func.apply(_, args));
      };
    });
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  _.each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name === 'shift' || name === 'splice') && obj.length === 0) delete obj[0];
      return result(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  _.each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result(this, method.apply(this._wrapped, arguments));
    };
  });

  // Extracts the result from a wrapped and chained object.
  _.prototype.value = function() {
    return this._wrapped;
  };

  // Provide unwrapping proxy for some methods used in engine operations
  // such as arithmetic and JSON stringification.
  _.prototype.valueOf = _.prototype.toJSON = _.prototype.value;

  _.prototype.toString = function() {
    return '' + this._wrapped;
  };

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}.call(this));

/* exported WIDGET_COMMON_CONFIG */
var WIDGET_COMMON_CONFIG = {
  AUTH_PATH_URL: "v1/widget/auth",
  LOGGER_CLIENT_ID: "1088527147109-6q1o2vtihn34292pjt4ckhmhck0rk0o7.apps.googleusercontent.com",
  LOGGER_CLIENT_SECRET: "nlZyrcPLg6oEwO9f9Wfn29Wh",
  LOGGER_REFRESH_TOKEN: "1/xzt4kwzE1H7W9VnKB8cAaCx6zb4Es4nKEoqaYHdTD15IgOrJDtdun6zK6XiATCKT",
  STORE_URL: "https://store-dot-rvaserver2.appspot.com/"
};
/* global WIDGET_COMMON_CONFIG */

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.LoggerUtils = (function() {
  "use strict";

   var displayId = "",
     companyId = "",
     version = null;

  /*
   *  Private Methods
   */

  /* Retrieve parameters to pass to the event logger. */
  function getEventParams(params, cb) {
    var json = null;

    // event is required.
    if (params.event) {
      json = params;

      if (json.file_url) {
        json.file_format = getFileFormat(json.file_url);
      }

      json.company_id = companyId;
      json.display_id = displayId;

      if (version) {
        json.version = version;
      }

      cb(json);
    }
    else {
      cb(json);
    }
  }

  // Get suffix for BQ table name.
  function getSuffix() {
    var date = new Date(),
      year = date.getUTCFullYear(),
      month = date.getUTCMonth() + 1,
      day = date.getUTCDate();

    if (month < 10) {
      month = "0" + month;
    }

    if (day < 10) {
      day = "0" + day;
    }

    return "" + year + month + day;
  }

  /*
   *  Public Methods
   */
  function getFileFormat(url) {
    var hasParams = /[?#&]/,
      str;

    if (!url || typeof url !== "string") {
      return null;
    }

    str = url.substr(url.lastIndexOf(".") + 1);

    // don't include any params after the filename
    if (hasParams.test(str)) {
      str = str.substr(0 ,(str.indexOf("?") !== -1) ? str.indexOf("?") : str.length);

      str = str.substr(0, (str.indexOf("#") !== -1) ? str.indexOf("#") : str.length);

      str = str.substr(0, (str.indexOf("&") !== -1) ? str.indexOf("&") : str.length);
    }

    return str.toLowerCase();
  }

  function getInsertData(params) {
    var BASE_INSERT_SCHEMA = {
      "kind": "bigquery#tableDataInsertAllRequest",
      "skipInvalidRows": false,
      "ignoreUnknownValues": false,
      "templateSuffix": getSuffix(),
      "rows": [{
        "insertId": ""
      }]
    },
    data = JSON.parse(JSON.stringify(BASE_INSERT_SCHEMA));

    data.rows[0].insertId = Math.random().toString(36).substr(2).toUpperCase();
    data.rows[0].json = JSON.parse(JSON.stringify(params));
    data.rows[0].json.ts = new Date().toISOString();

    return data;
  }

  function logEvent(table, params) {
    getEventParams(params, function(json) {
      if (json !== null) {
        RiseVision.Common.Logger.log(table, json);
      }
    });
  }

  function logEventToPlayer(table, params) {
    try {
      top.postToPlayer( {
        message: "widget-log",
        table: table,
        params: JSON.stringify(params),
        suffix: getSuffix()
      } );
    } catch (err) {
      console.log("widget-common.logEventToPlayer", err);
    }
  }

  /* Set the Company and Display IDs. */
  function setIds(company, display) {
    companyId = company;
    displayId = display;
  }

  function setVersion(value) {
    version = value;
  }

  return {
    "getInsertData": getInsertData,
    "getFileFormat": getFileFormat,
    "logEvent": logEvent,
    "logEventToPlayer": logEventToPlayer,
    "setIds": setIds,
    "setVersion": setVersion
  };
})();

RiseVision.Common.Logger = (function(utils) {
  "use strict";

  var REFRESH_URL = "https://www.googleapis.com/oauth2/v3/token?client_id=" + WIDGET_COMMON_CONFIG.LOGGER_CLIENT_ID +
      "&client_secret=" + WIDGET_COMMON_CONFIG.LOGGER_CLIENT_SECRET +
      "&refresh_token=" + WIDGET_COMMON_CONFIG.LOGGER_REFRESH_TOKEN +
      "&grant_type=refresh_token";

  var serviceUrl = "https://www.googleapis.com/bigquery/v2/projects/client-side-events/datasets/Widget_Events/tables/TABLE_ID/insertAll",
    throttle = false,
    throttleDelay = 1000,
    lastEvent = "",
    refreshDate = 0,
    token = "";

  /*
   *  Private Methods
   */
  function refreshToken(cb) {
    var xhr = new XMLHttpRequest();

    if (new Date() - refreshDate < 3580000) {
      return cb({});
    }

    xhr.open("POST", REFRESH_URL, true);
    xhr.onloadend = function() {
      var resp = {};
      try {
        resp = JSON.parse(xhr.response);
      } catch(e) {
        console.warn("Can't refresh logger token - ", e.message);
      }
      cb({ token: resp.access_token, refreshedAt: new Date() });
    };

    xhr.send();
  }

  function isThrottled(event) {
    return throttle && (lastEvent === event);
  }

  /*
   *  Public Methods
   */
  function log(tableName, params) {
    if (!tableName || !params || (params.hasOwnProperty("event") && !params.event) ||
      (params.hasOwnProperty("event") && isThrottled(params.event))) {
      return;
    }

    // don't log if display id is invalid or preview/local
    if (!params.display_id || params.display_id === "preview" || params.display_id === "display_id" ||
      params.display_id === "displayId") {
      return;
    }

    try {
      if ( top.postToPlayer && top.enableWidgetLogging ) {
        // send log data to player instead of BQ
        return utils.logEventToPlayer( tableName, params );
      }
    } catch ( e ) {
      console.log( "widget-common: logger", e );
    }

    throttle = true;
    lastEvent = params.event;

    setTimeout(function () {
      throttle = false;
    }, throttleDelay);

    function insertWithToken(refreshData) {
      var xhr = new XMLHttpRequest(),
        insertData, url;

      url = serviceUrl.replace("TABLE_ID", tableName);
      refreshDate = refreshData.refreshedAt || refreshDate;
      token = refreshData.token || token;
      insertData = utils.getInsertData(params);

      // Insert the data.
      xhr.open("POST", url, true);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.setRequestHeader("Authorization", "Bearer " + token);

      if (params.cb && typeof params.cb === "function") {
        xhr.onloadend = function() {
          params.cb(xhr.response);
        };
      }

      xhr.send(JSON.stringify(insertData));
    }

    return refreshToken(insertWithToken);
  }

  return {
    "log": log
  };
})(RiseVision.Common.LoggerUtils);

/* global WebFont */

var RiseVision = RiseVision || {};

RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.Utilities = (function() {

  function getFontCssStyle(className, fontObj) {
    var family = "font-family: " + decodeURIComponent(fontObj.font.family).replace(/'/g, "") + "; ";
    var color = "color: " + (fontObj.color ? fontObj.color : fontObj.forecolor) + "; ";
    var size = "font-size: " + (fontObj.size.indexOf("px") === -1 ? fontObj.size + "px; " : fontObj.size + "; ");
    var weight = "font-weight: " + (fontObj.bold ? "bold" : "normal") + "; ";
    var italic = "font-style: " + (fontObj.italic ? "italic" : "normal") + "; ";
    var underline = "text-decoration: " + (fontObj.underline ? "underline" : "none") + "; ";
    var highlight = "background-color: " + (fontObj.highlightColor ? fontObj.highlightColor : fontObj.backcolor) + ";";

    return "." + className + " {" + family + color + size + weight + italic + underline + highlight + "}";
  }

  function addCSSRules(rules) {
    var style = document.createElement("style");

    for (var i = 0, length = rules.length; i < length; i++) {
      style.appendChild(document.createTextNode(rules[i]));
    }

    document.head.appendChild(style);
  }

  /*
   * Loads Google or custom fonts, if applicable, and injects CSS styles
   * into the head of the document.
   *
   * @param    array    settings    Array of objects with the following form:
 *                                   [{
 *                                     "class": "date",
 *                                     "fontSetting": {
 *                                         bold: true,
 *                                         color: "black",
 *                                         font: {
 *                                           family: "Akronim",
 *                                           font: "Akronim",
 *                                           name: "Verdana",
 *                                           type: "google",
 *                                           url: "http://custom-font-url"
 *                                         },
 *                                         highlightColor: "transparent",
 *                                         italic: false,
 *                                         size: "20",
 *                                         underline: false
 *                                     }
 *                                   }]
   *
   *           object   contentDoc    Document object into which to inject styles
   *                                  and load fonts (optional).
   */
  function loadFonts(settings, cb) {
    var families = null,
      googleFamilies = [],
      customFamilies = [],
      customUrls = [];

    function callback() {
      if (cb && typeof cb === "function") {
        cb();
      }
    }

    function onGoogleFontsLoaded() {
      callback();
    }

    if (!settings || settings.length === 0) {
      callback();
      return;
    }

    // Check for custom css class names and add rules if so
    settings.forEach(function(item) {
      if (item.class && item.fontStyle) {
        addCSSRules([ getFontCssStyle(item.class, item.fontStyle) ]);
      }
    });

    // Google fonts
    for (var i = 0; i < settings.length; i++) {
      if (settings[i].fontStyle && settings[i].fontStyle.font.type &&
        (settings[i].fontStyle.font.type === "google")) {
        // Remove fallback font.
        families = settings[i].fontStyle.font.family.split(",")[0];

        // strip possible single quotes
        families = families.replace(/'/g, "");

        googleFamilies.push(families);
      }
    }

    // Custom fonts
    for (i = 0; i < settings.length; i++) {
      if (settings[i].fontStyle && settings[i].fontStyle.font.type &&
        (settings[i].fontStyle.font.type === "custom")) {
        // decode value and strip single quotes
        customFamilies.push(decodeURIComponent(settings[i].fontStyle.font.family).replace(/'/g, ""));
        // strip single quotes
        customUrls.push(settings[i].fontStyle.font.url.replace(/'/g, "\\'"));
      }
    }

    if (googleFamilies.length === 0 && customFamilies.length === 0) {
      callback();
    }
    else {
      // Load the fonts
      for (var j = 0; j < customFamilies.length; j += 1) {
        loadCustomFont(customFamilies[j], customUrls[j]);
      }

      if (googleFamilies.length > 0) {
        loadGoogleFonts(googleFamilies, onGoogleFontsLoaded);
      }
      else {
        callback();
      }
    }
  }

  function loadCustomFont(family, url, contentDoc) {
    var sheet = null;
    var rule = "font-family: " + family + "; " + "src: url('" + url + "');";

    contentDoc = contentDoc || document;

    sheet = contentDoc.styleSheets[0];

    if (sheet !== null) {
      sheet.addRule("@font-face", rule);
    }
  }

  function loadGoogleFonts(families, cb) {
    WebFont.load({
      google: {
        families: families
      },
      active: function() {
        if (cb && typeof cb === "function") {
          cb();
        }
      },
      inactive: function() {
        if (cb && typeof cb === "function") {
          cb();
        }
      },
      timeout: 5000
    });
  }

  function loadScript( src ) {
    var script = document.createElement( "script" );

    script.src = src;
    document.body.appendChild( script );
  }

  function preloadImages(urls) {
    var length = urls.length,
      images = [];

    for (var i = 0; i < length; i++) {
      images[i] = new Image();
      images[i].src = urls[i];
    }
  }

  /**
   * Get the current URI query param
   */
  function getQueryParameter(param) {
    return getQueryStringParameter(param, window.location.search.substring(1));
  }

  /**
   * Get the query parameter from a query string
   */
  function getQueryStringParameter(param, query) {
    var vars = query.split("&"),
      pair;

    for (var i = 0; i < vars.length; i++) {
      pair = vars[i].split("=");

      if (pair[0] == param) { // jshint ignore:line
        return decodeURIComponent(pair[1]);
      }
    }

    return "";
  }

  /**
   * Get date object from player version string
   */
  function getDateObjectFromPlayerVersionString(playerVersion) {
    var reggie = /(\d{4})\.(\d{2})\.(\d{2})\.(\d{2})\.(\d{2})/;
    var dateArray = reggie.exec(playerVersion);
    if (dateArray) {
      return new Date(
        (+dateArray[1]),
          (+dateArray[2])-1, // Careful, month starts at 0!
        (+dateArray[3]),
        (+dateArray[4]),
        (+dateArray[5])
      );
    } else {
      return;
    }
  }

  function getRiseCacheErrorMessage(statusCode) {
    var errorMessage = "";
    switch (statusCode) {
      case 404:
        errorMessage = "The file does not exist or cannot be accessed.";
        break;
      case 507:
        errorMessage = "There is not enough disk space to save the file on Rise Cache.";
        break;
      default:
        errorMessage = "There was a problem retrieving the file from Rise Cache.";
    }

    return errorMessage;
  }

  function unescapeHTML(html) {
    var div = document.createElement("div");

    div.innerHTML = html;

    return div.textContent;
  }

  function hasInternetConnection(filePath, callback) {
    var xhr = new XMLHttpRequest();

    if (!filePath || !callback || typeof callback !== "function") {
      return;
    }

    xhr.open("HEAD", filePath + "?cb=" + new Date().getTime(), false);

    try {
      xhr.send();

      callback((xhr.status >= 200 && xhr.status < 304));

    } catch (e) {
      callback(false);
    }
  }

  /**
   * Check if chrome version is under a certain version
   */
  function isLegacy() {
    var legacyVersion = 25;

    var match = navigator.userAgent.match(/Chrome\/(\S+)/);
    var version = match ? match[1] : 0;

    if (version) {
      version = parseInt(version.substring(0,version.indexOf(".")));

      if (version <= legacyVersion) {
        return true;
      }
    }

    return false;
  }

  /**
   * Adds http:// or https:// protocol to url if the protocol is missing
   */
  function addProtocol(url, secure) {
    if (!/^(?:f|ht)tps?\:\/\//.test(url)) {
      url = ((secure) ? "https://" : "http://") + url;
    }
    return url;
  }

  return {
    addProtocol:              addProtocol,
    getQueryParameter:        getQueryParameter,
    getQueryStringParameter:  getQueryStringParameter,
    getFontCssStyle:          getFontCssStyle,
    addCSSRules:              addCSSRules,
    loadFonts:                loadFonts,
    loadCustomFont:           loadCustomFont,
    loadGoogleFonts:          loadGoogleFonts,
    loadScript:               loadScript,
    preloadImages:            preloadImages,
    getRiseCacheErrorMessage: getRiseCacheErrorMessage,
    unescapeHTML:             unescapeHTML,
    hasInternetConnection:    hasInternetConnection,
    isLegacy:                 isLegacy,
    getDateObjectFromPlayerVersionString: getDateObjectFromPlayerVersionString
  };
})();

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.RiseCache = (function () {
  "use strict";

  var BASE_CACHE_URL = "http://localhost:9494/";

  var _pingReceived = false,
    _isCacheRunning = false,
    _isV2Running = false,
    _isHttps = true,
    _utils = RiseVision.Common.Utilities,
    _RC_VERSION_WITH_ENCODE = "1.7.3",
    _RC_VERSION = "";

  function ping(callback) {
    var r = new XMLHttpRequest(),
      /* jshint validthis: true */
      self = this;

    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_isV2Running) {
      r.open("GET", BASE_CACHE_URL + "ping?callback=_", true);
    }
    else {
      r.open("GET", BASE_CACHE_URL, true);
    }

    r.onreadystatechange = function () {
      try {
        if (r.readyState === 4 ) {
          // save this result for use in getFile()
          _pingReceived = true;

          if(r.status === 200) {
            _isCacheRunning = true;

            try {
              var responseObject = (r.responseText) ? JSON.parse(r.responseText) : "";
              if (responseObject) {
                _RC_VERSION = responseObject.version;
              }
            }
            catch(e) {
              console.log(e);
            }

            callback(true, r.responseText);
          } else if (r.status === 404) {
            // Rise Cache V2 is running
            _isV2Running = true;

            BASE_CACHE_URL = "https://localhost:9495/";

            // call ping again so correct ping URL is used for Rise Cache V2
            return self.ping(callback);
          } else {

            if ( _isHttps ) {
              _isV2Running = true;
              _isHttps = false;
              BASE_CACHE_URL = "http://localhost:9494/";

              // call ping again so correct ping URL is used for Rise Cache V2 HTTPs
              return self.ping(callback);
            } else {
              console.debug("Rise Cache is not running");
              _isV2Running = false;
              _isCacheRunning = false;

              callback(false, null);
            }
          }
        }
      }
      catch (e) {
        console.debug("Caught exception: ", e.description);
      }

    };
    r.send();
  }

  function getFile(fileUrl, callback, nocachebuster) {
    if (!fileUrl || !callback || typeof callback !== "function") {
      return;
    }

    var totalCacheRequests = 0;

    function fileRequest() {
      var url, str, separator;

      if (_isCacheRunning) {
        if (_isV2Running) {
          if ( _compareVersionNumbers( _RC_VERSION, _RC_VERSION_WITH_ENCODE ) > 0 ) {
            url = BASE_CACHE_URL + "files?url=" + fileUrl;
          } else {
            url = BASE_CACHE_URL + "files?url=" + encodeURIComponent(fileUrl);
          }
        } else {
          // configure url with cachebuster or not
          url = (nocachebuster) ? BASE_CACHE_URL + "?url=" + encodeURIComponent(fileUrl) :
          BASE_CACHE_URL + "cb=" + new Date().getTime() + "?url=" + encodeURIComponent(fileUrl);
        }
      } else {
        if (nocachebuster) {
          url = fileUrl;
        } else {
          str = fileUrl.split("?");
          separator = (str.length === 1) ? "?" : "&";
          url = fileUrl + separator + "cb=" + new Date().getTime();
        }
      }

      makeRequest("HEAD", url);
    }

    function _compareVersionNumbers( v1, v2 ) {
      var v1parts = v1.split( "." ),
        v2parts = v2.split( "." ),
        i = 0;

      function isPositiveInteger( x ) {
        return /^\d+$/.test( x );
      }

      // First, validate both numbers are true version numbers
      function validateParts( parts ) {
        for ( i = 0; i < parts.length; i++ ) {
          if ( !isPositiveInteger( parts[ i ] ) ) {
            return false;
          }
        }
        return true;
      }
      if ( !validateParts( v1parts ) || !validateParts( v2parts ) ) {
        return NaN;
      }

      for ( i = 0; i < v1parts.length; ++i ) {
        if ( v2parts.length === i ) {
          return 1;
        }

        if ( v1parts[ i ] === v2parts[ i ] ) {
          continue;
        }
        if ( v1parts[ i ] > v2parts[ i ] ) {
          return 1;
        }
        return -1;
      }

      if ( v1parts.length !== v2parts.length ) {
        return -1;
      }

      return 0;
    }

    function makeRequest(method, url) {
      var xhr = new XMLHttpRequest(),
        request = {
          xhr: xhr,
          url: url
        };

      if (_isCacheRunning) {
        xhr.open(method, url, true);

        xhr.addEventListener("loadend", function () {
          var status = xhr.status || 0;
          if (status === 202) {
              totalCacheRequests++;
              if (totalCacheRequests < 3) {
                setTimeout(function(){ makeRequest(method, url); }, 3000);
              } else {
                  callback(request, new Error("File is downloading"));
              }
          } else if (status >= 200 && status < 300) {
            callback(request);
          } else {
            // Server may not support HEAD request. Fallback to a GET request.
            if (method === "HEAD") {
              makeRequest("GET", url);
            } else {
              callback(request, new Error("The request failed with status code: " + status));
            }
          }
        });

        xhr.send();
      }
      else {
        // Rise Cache is not running (preview), skip HEAD request and execute callback immediately
        callback(request);
      }

    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(fileRequest);
    } else {
      return fileRequest();
    }

  }

  function getErrorMessage(statusCode) {
    var errorMessage = "";
    switch (statusCode) {
      case 502:
        errorMessage = "There was a problem retrieving the file.";
        break;
      case 504:
        errorMessage = "Unable to download the file. The server is not responding.";
        break;
      case 507:
        errorMessage = "There is not enough disk space to save the file on Rise Cache.";
        break;
      case 534:
        errorMessage = "The file does not exist or cannot be accessed.";
        break;
      default:
        errorMessage = "";
    }

    return errorMessage;
  }

  function isRiseCacheRunning(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(function () {
        callback(_isCacheRunning);
      });
    } else {
      callback(_isCacheRunning);
    }
  }

  function isV2Running(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }

    if (!_pingReceived) {
      /* jshint validthis: true */
      return this.ping(function () {
        callback(_isV2Running);
      });
    }
    else {
      callback(_isV2Running);
    }
  }

  function isRCV2Player(callback) {
    if (!callback || typeof callback !== "function") {
      return;
    }
    /* jshint validthis: true */
    return this.isV2Running(function (isV2Running) {
      if (isV2Running) {
        callback(isV2Running);
      } else {
        callback(isV3PlayerVersionWithRCV2());
      }
    });
  }

  function isV3PlayerVersionWithRCV2() {
    var RC_V2_FIRST_PLAYER_VERSION_DATE = _utils.getDateObjectFromPlayerVersionString("2016.10.10.00.00");

    var sysInfoViewerParameter = _utils.getQueryParameter("sysInfo");
    if (!sysInfoViewerParameter) {
      // when the widget is loaded into an iframe the search has a parameter called parent which represents the parent url
      var parentParameter = _utils.getQueryParameter("parent");
      sysInfoViewerParameter = _utils.getQueryStringParameter("sysInfo", parentParameter);
    }
    if (sysInfoViewerParameter) {
      var playerVersionString = _utils.getQueryStringParameter("pv", sysInfoViewerParameter);
      var playerVersionDate = _utils.getDateObjectFromPlayerVersionString(playerVersionString);
      return playerVersionDate >= RC_V2_FIRST_PLAYER_VERSION_DATE;
    } else {
      return false;
    }
  }

  function reset() {
    _pingReceived = false;
     _isCacheRunning = false;
     _isV2Running = false;
     _isHttps = true;
    BASE_CACHE_URL = "http://localhost:9494/";
  }

  return {
    getErrorMessage: getErrorMessage,
    getFile: getFile,
    isRiseCacheRunning: isRiseCacheRunning,
    isV2Running: isV2Running,
    isRCV2Player: isRCV2Player,
    ping: ping,
    reset: reset
  };

})();

var RiseVision = RiseVision || {};
RiseVision.Common = RiseVision.Common || {};

RiseVision.Common.WSClient = (function() {

  function broadcastMessage(message) {
    safeWrite(message);
  }

  function canConnect() {
    try {
      if (top.RiseVision.Viewer.LocalMessaging) {
        return top.RiseVision.Viewer.LocalMessaging.canConnect();
      }
    } catch (err) {
      console.log( "widget-common: ws-client", err );
    }
  }

  function getModuleClientList() {
    safeWrite({topic: "client-list-request"});
  }

  function receiveMessages(handler) {
    if (!handler || typeof handler !== "function") {return;}

    try {
      if (top.RiseVision.Viewer.LocalMessaging) {
        top.RiseVision.Viewer.LocalMessaging.receiveMessages(handler);
      }
    } catch (err) {
      console.log( "widget-common: ws-client", err );
    }
  }

  function safeWrite(message) {
    try {
      if (top.RiseVision.Viewer.LocalMessaging) {
        top.RiseVision.Viewer.LocalMessaging.write(message);
      }
    } catch (err) {
      console.log( "widget-common: ws-client", err );
    }
  }

  return {
    broadcastMessage: broadcastMessage,
    canConnect: canConnect,
    getModuleClientList: getModuleClientList,
    receiveMessages: receiveMessages
  };
})();
/* exported version */
var version = "0.1.1";
/* exported config */
var config = {
  STORAGE_ENV: "prod",
  COMPONENTS_PATH: "components/"
};

if ( typeof angular !== "undefined" ) {
  angular.module( "risevision.common.i18n.config", [] )
    .constant( "LOCALES_PREFIX", "locales/translation_" )
    .constant( "LOCALES_SUFIX", ".json" );
}

/* global gadgets, _ */

var RiseVision = RiseVision || {};

RiseVision.Image = {};

RiseVision.Image = ( function( gadgets ) {
  "use strict";

  var _mode,
    _displayId,
    _prefs = new gadgets.Prefs(),
    _message = null,
    _params = null,
    _storage = null,
    _nonStorage = null,
    _localStorage = null,
    _slider = null,
    _currentFiles = [],
    _errorLog = null,
    _configurationType = null,
    _errorTimer = null,
    _errorFlag = false,
    _storageErrorFlag = false,
    _configurationLogged = false,
    _unavailableFlag = false,
    _viewerPaused = true,
    _img = null,
    _isGif = false;

  /*
   *  Private Methods
   */
  function _ready() {
    gadgets.rpc.call( "", "rsevent_ready", null, _prefs.getString( "id" ),
      true, true, true, true, true );
  }

  function _done() {
    gadgets.rpc.call( "", "rsevent_done", null, _prefs.getString( "id" ) );

    // Any errors need to be logged before the done event.
    if ( _errorLog !== null ) {
      logEvent( _errorLog, true );
    }

    // log "done" event
    logEvent( { "event": "done", "file_url": _getCurrentFile() }, false );
  }

  function _clearErrorTimer() {
    clearTimeout( _errorTimer );
    _errorTimer = null;
  }

  function _startErrorTimer() {
    _clearErrorTimer();

    _errorTimer = setTimeout( function() {
      // notify Viewer widget is done
      _done();
    }, 5000 );
  }

  function _getCurrentFile() {
    var slideNum = -1;

    if ( _currentFiles && _currentFiles.length > 0 ) {
      if ( _mode === "file" ) {
        return _currentFiles[ 0 ];
      } else if ( _mode === "folder" && _slider && _slider.isReady() ) {
        // retrieve the currently played slide
        slideNum = _slider.getCurrentSlide();

        if ( slideNum !== -1 ) {
          return ( _currentFiles[ slideNum ] ) ? ( _currentFiles[ slideNum ] ).url : null;
        }
      }
    }

    return null;
  }

  function _testLocalStorage() {
    // don't test if display id is invalid or preview/local
    if ( !_displayId || _displayId === "preview" || _displayId === "display_id" || _displayId.indexOf( "displayId" ) !== -1 ) {
      return;
    }

    _localStorage = new RiseVision.Image.LocalStorageFile();
    _localStorage.init();
  }

  function init() {
    var container = document.getElementById( "container" ),
      fragment = document.createDocumentFragment(),
      el = document.createElement( "div" ),
      isStorageFile;

    // create instance of message
    _message = new RiseVision.Image.Message( document.getElementById( "container" ),
      document.getElementById( "messageContainer" ) );

    // show wait message
    _message.show( "Please wait while your image is downloaded." );

    // legacy
    if ( _params.background && Object.keys( _params.background ).length > 0 ) {
      document.body.style.background = _params.background.color;
    }

    if ( _mode === "file" ) {
      // create the image <div> within the container <div>
      el = _getImageElement();
      fragment.appendChild( el );
      container.appendChild( fragment );

      _img = new Image();

      isStorageFile = ( Object.keys( _params.storage ).length !== 0 );

      if ( !isStorageFile ) {
        _configurationType = "custom";

        _nonStorage = new RiseVision.Image.NonStorage( _params );
        _nonStorage.init();
      } else {
        _configurationType = "storage file";

        // create and initialize the Storage file instance
        _storage = new RiseVision.Image.StorageFile( _params, _displayId );
        _storage.init();
      }
    } else if ( _mode === "folder" ) {
      // create the slider container <div> within the container <div>
      el.className = "tp-banner-container";

      fragment.appendChild( el );
      container.appendChild( fragment );

      _configurationType = "storage folder";

      // create and initialize the Storage folder instance
      _storage = new RiseVision.Image.StorageFolder( _params, _displayId );
      _storage.init();
    }

    _testLocalStorage();
    _ready();
  }

  function _getImageElement() {
    var el = document.createElement( "div" );

    el.setAttribute( "id", "image" );
    el.className = _params.position;
    el.className = _params.scaleToFit ? el.className + " scale-to-fit" : el.className;

    return el;
  }

  function setSingleImage( url ) {

    _img.onload = function() {
      var image = document.querySelector( "#container #image" );

      image.style.backgroundImage = "none";
      image.style.backgroundImage = "url('" + url + "')";
      _isGif = url.indexOf( ".gif" ) === -1 ? false : true;

      // If widget is playing right now make sure the div image element is visible
      if ( !_viewerPaused && _isGif ) {
        image.style.visibility = "visible";
      }
    };

    _img.onerror = function() {
      logEvent( {
        "event": "error",
        "event_details": "image load error",
        "file_url": url
      }, true );
    };

    // handles special characters
    _img.src = url.replace( "\\'", "'" );
  }

  /*
   *  Public Methods
   */
  function hasStorageError() {
    return _storageErrorFlag;
  }

  function logEvent( params, isError ) {
    if ( isError ) {
      _errorLog = params;
    }

    RiseVision.Common.LoggerUtils.logEvent( getTableName(), params );
  }

  function onFileInit( urls ) {
    if ( _mode === "file" ) {
      // urls value will be a string
      _currentFiles[ 0 ] = urls;

      _unavailableFlag = false;

      // remove a message previously shown
      _message.hide();

      setSingleImage( _currentFiles[ 0 ] );

    } else if ( _mode === "folder" ) {
      // urls value will be an array
      _currentFiles = urls;

      // create slider instance
      _slider = new RiseVision.Image.Slider( _params );
      _slider.init( urls );
    }
  }

  function onFileRefresh( urls ) {
    if ( _mode === "file" ) {
      // urls value will be a string of one url
      _currentFiles[ 0 ] = urls;

      if ( _unavailableFlag ) {
        // remove the message previously shown
        _message.hide();
      }

      setSingleImage( _currentFiles[ 0 ] );

    } else if ( _mode === "folder" ) {
      // urls value will be an array of urls
      _currentFiles = urls;

      _slider.refresh( _currentFiles );
    }

    // in case refreshed file fixes an error with previous file, ensure flag is removed so playback is attempted again
    _errorFlag = false;
    _storageErrorFlag = false;
    _unavailableFlag = false;
    _errorLog = null;
  }

  function onFileUnavailable( message ) {
    _unavailableFlag = true;

    _message.show( message );

    // if Widget is playing right now, run the timer
    if ( !_viewerPaused ) {
      _startErrorTimer();
    }
  }

  function setAdditionalParams( additionalParams, modeType, displayId ) {
    _params = _.clone( additionalParams );
    _mode = modeType;
    _displayId = displayId;

    _params.width = _prefs.getInt( "rsW" );
    _params.height = _prefs.getInt( "rsH" );

    document.getElementById( "container" ).style.height = _prefs.getInt( "rsH" ) + "px";
    init();
  }

  function onSliderReady() {
    _message.hide();

    if ( !_viewerPaused ) {
      _slider.play();
    }
  }

  function onSliderComplete() {
    _done();
  }

  function pause() {
    var image = document.querySelector( "#container #image" );

    _viewerPaused = true;

    // in case error timer still running (no conditional check on errorFlag, it may have been reset in onFileRefresh)
    _clearErrorTimer();

    if ( _mode === "folder" && _slider && _slider.isReady() ) {
      _slider.pause();
    } else if ( _mode === "file" && image && _isGif ) {
      image.style.visibility = "hidden";
    }
  }

  function play() {
    var image = document.querySelector( "#container #image" );

    _viewerPaused = false;

    if ( !_configurationLogged ) {
      logEvent( { "event": "configuration", "event_details": _configurationType }, false );
      _configurationLogged = true;
    }

    logEvent( { "event": "play", "file_url": _getCurrentFile() }, false );

    if ( _errorFlag ) {
      _startErrorTimer();
      return;
    }

    if ( _unavailableFlag ) {
      if ( _mode === "file" && _storage ) {
        _storage.retry();
      }

      return;
    }

    if ( _mode === "folder" && _slider && _slider.isReady() ) {
      _slider.play();
    } else if ( _mode === "file" && image && _isGif ) {
      image.style.visibility = "visible";
    }
  }

  function getTableName() {
    return "image_events";
  }

  function showError( message, isStorageError ) {
    _errorFlag = true;
    _storageErrorFlag = typeof isStorageError !== "undefined";

    _message.show( message );

    // destroy slider if it exists and previously notified ready
    if ( _mode === "folder" && _slider && _slider.isReady() ) {
      _slider.destroy();
    }

    if ( !_viewerPaused ) {
      _startErrorTimer();
    }
  }

  function stop() {
    pause();
  }

  return {
    "hasStorageError": hasStorageError,
    "logEvent": logEvent,
    "onFileInit": onFileInit,
    "onFileRefresh": onFileRefresh,
    "onFileUnavailable": onFileUnavailable,
    "onSliderComplete": onSliderComplete,
    "onSliderReady": onSliderReady,
    "pause": pause,
    "play": play,
    "setAdditionalParams": setAdditionalParams,
    "getTableName": getTableName,
    "showError": showError,
    "stop": stop
  };
} )( gadgets );

var RiseVision = RiseVision || {};

RiseVision.Image = RiseVision.Image || {};

RiseVision.Image.Message = function( mainContainer, messageContainer ) {
  "use strict";

  var _active = false;

  function _init() {
    try {
      messageContainer.style.height = mainContainer.style.height;
    } catch ( e ) {
      console.warn( "Can't initialize Message - ", e.message ); // eslint-disable-line no-console
    }
  }

  /*
   *  Public Methods
   */
  function hide() {
    if ( _active ) {
      // clear content of message container
      while ( messageContainer.firstChild ) {
        messageContainer.removeChild( messageContainer.firstChild );
      }

      // hide message container
      messageContainer.style.display = "none";

      // show main container
      mainContainer.style.visibility = "visible";

      _active = false;
    }
  }

  function show( message ) {
    var fragment = document.createDocumentFragment(),
      p;

    if ( !_active ) {
      // hide main container
      mainContainer.style.visibility = "hidden";

      messageContainer.style.display = "block";

      // create message element
      p = document.createElement( "p" );
      p.innerHTML = message;
      p.setAttribute( "class", "message" );

      fragment.appendChild( p );
      messageContainer.appendChild( fragment );

      _active = true;
    } else {
      // message already being shown, update message text
      p = messageContainer.querySelector( ".message" );
      p.innerHTML = message;
    }
  }

  _init();

  return {
    "hide": hide,
    "show": show
  };
};

/* global _, $ */
var RiseVision = RiseVision || {};

RiseVision.Image = RiseVision.Image || {};

RiseVision.Image.Slider = function( params ) {
  "use strict";

  var totalSlides = 0,
    $api = null,
    currentFiles = null,
    newFiles = null,
    navTimer = null,
    slideTimer = null,
    isLastSlide = false,
    refreshSlider = false,
    isLoading = true,
    isPlaying = false,
    isInteracting = false,
    navTimeout = 3000,
    singleImagePUDTimer = null;

  /*
   *  Private Methods
   */
  function addSlides() {
    var list = document.querySelector( ".tp-banner ul" ),
      fragment = document.createDocumentFragment(),
      slides = [],
      slide = null,
      image = null,
      position = "";

    totalSlides = currentFiles.length;

    currentFiles.forEach( function( file ) {
      slide = document.createElement( "li" );
      image = document.createElement( "img" );

      // Transition
      slide.setAttribute( "data-transition", "fade" );
      slide.setAttribute( "data-masterspeed", 500 );
      slide.setAttribute( "data-delay", params.duration * 1000 );

      // Lazy load
      image.src = "";
      image.setAttribute( "data-lazyload", file.url );

      // Alignment
      switch ( params.position ) {
      case "top-left":
        position = "left top";
        break;
      case "top-center":
        position = "center top";
        break;
      case "top-right":
        position = "right top";
        break;
      case "middle-left":
        position = "left center";
        break;
      case "middle-center":
        position = "center center";
        break;
      case "middle-right":
        position = "right center";
        break;
      case "bottom-left":
        position = "left bottom";
        break;
      case "bottom-center":
        position = "center bottom";
        break;
      case "bottom-right":
        position = "right bottom";
        break;
      default:
        position = "left top";
      }

      image.setAttribute( "data-bgposition", position );

      // Scale to Fit
      if ( params.scaleToFit ) {
        image.setAttribute( "data-bgfit", "contain" );
      } else {
        image.setAttribute( "data-bgfit", "normal" );
      }

      slide.appendChild( image );
      slides.push( slide );
    } );

    slides.forEach( function( slide ) {
      fragment.appendChild( slide );
    } );

    list.appendChild( fragment );
  }

  function onSlideChanged( data ) {
    if ( isInteracting ) {
      pause();
    } else {
      // Don't call "done" if user is interacting with the slideshow.
      if ( isLastSlide ) {
        isLastSlide = false;
        pause();
        RiseVision.Image.onSliderComplete();

        if ( refreshSlider ) {
          // Destroy and recreate the slider if the files have changed.
          if ( $api ) {
            destroySlider();
            init( newFiles );
          }

          refreshSlider = false;
        }
      }
    }

    if ( data.slideIndex === totalSlides ) {
      isLastSlide = true;
    }
  }

  function destroySlider() {
    // Remove event handlers.
    $( "body" ).off( "touchend" );
    $api.off( "revolution.slide.onloaded" );
    $api.off( "revolution.slide.onchange" );

    // Let the slider clean up after itself.
    $api.revkill();
    $api = null;
  }

  // User has interacted with the slideshow.
  function handleUserActivity() {
    isInteracting = true;
    clearTimeout( slideTimer );

    // Move to next slide and resume the slideshow after a delay.
    slideTimer = setTimeout( function() {
      $api.revnext();
      $api.revresume();

      isInteracting = false;
      isPlaying = true;
    }, params.pause * 1000 );

    hideNav();
  }

  // Hide the navigation after a delay.
  function hideNav() {
    if ( params.autoHide ) {
      clearTimeout( navTimer );

      navTimer = setTimeout( function() {
        $( ".tp-leftarrow, .tp-rightarrow" ).addClass( "hidearrows" );
      }, navTimeout );
    }
  }

  function startSingleImagePUDTimer() {
    var delay = ( ( params.duration === undefined ) || ( params.duration < 1 ) ) ? 10000 : params.duration * 1000;

    singleImagePUDTimer = setTimeout( function() {
      RiseVision.Image.onSliderComplete();
    }, delay );
  }

  /*
   *  Public Methods
   *  TODO: Test what happens when folder isn't found.
   */
  function destroy() {
    if ( $api ) {
      isLastSlide = false;
      pause();
      destroySlider();
    }
  }

  function getCurrentSlide() {
    if ( $api && currentFiles && currentFiles.length > 0 ) {
      return $api.revcurrentslide();
    }

    return -1;
  }

  function init( files ) {
    var tpBannerContainer = document.querySelector( ".tp-banner-container" ),
      fragment = document.createDocumentFragment(),
      tpBanner = document.createElement( "div" ),
      ul = document.createElement( "ul" );

    tpBanner.setAttribute( "class", "tp-banner" );
    tpBanner.appendChild( ul );
    fragment.appendChild( tpBanner );
    tpBannerContainer.appendChild( fragment );

    currentFiles = _.clone( files );

    addSlides();

    isLoading = true;
    $api = $( ".tp-banner" ).revolution( {
      "hideThumbs": 0,
      "hideTimerBar": "on",
      "navigationType": "none",
      "onHoverStop": "off",
      "startwidth": params.width,
      "startheight": params.height
    } );

    $api.on( "revolution.slide.onloaded", function() {
      // Pause slideshow since it will autoplay and this is not configurable.
      pause();
      isLoading = false;
      RiseVision.Image.onSliderReady();
    } );

    $api.on( "revolution.slide.onchange", function( e, data ) {
      onSlideChanged( data );
    } );

    // Swipe the slider.
    $( "body" ).on( "touchend", ".tp-banner", function() {
      handleUserActivity();
      $( ".tp-leftarrow, .tp-rightarrow" ).removeClass( "hidearrows" );
    } );

    // Touch the navigation arrows.
    $( "body" ).on( "touchend", ".tp-leftarrow, .tp-rightarrow", function() {
      handleUserActivity();
    } );

    hideNav();
  }

  function isReady() {
    return !isLoading;
  }

  function play() {
    if ( $api ) {
      // Reset slideshow to first slide.
      if ( params.hasOwnProperty( "resume" ) && !params.resume ) {
        $api.revshowslide( 0 );
      }

      if ( !isPlaying ) {
        $api.revresume();
        isPlaying = true;
      }

      if ( currentFiles.length === 1 ) {
        startSingleImagePUDTimer();
      }
    }
  }

  function pause() {
    if ( $api && isPlaying ) {
      $api.revpause();
      isPlaying = false;
    }

    if ( singleImagePUDTimer ) {
      clearTimeout( singleImagePUDTimer );
    }
  }

  function refresh( files ) {
    // Start preloading images right away.
    RiseVision.Common.Utilities.preloadImages( files );

    if ( currentFiles.length === 1 ) {
      // Destroy and recreate the slider immediately if currently only 1 slide and there has been a change.
      if ( $api ) {
        clearTimeout( singleImagePUDTimer );
        destroySlider();
        init( files );
      }
    } else {
      newFiles = _.clone( files );
      refreshSlider = true;
    }

  }

  return {
    "getCurrentSlide": getCurrentSlide,
    "destroy": destroy,
    "init": init,
    "isReady": isReady,
    "play": play,
    "pause": pause,
    "refresh": refresh
  };
};

/* global config */
var RiseVision = RiseVision || {};

RiseVision.Image = RiseVision.Image || {};

RiseVision.Image.StorageFile = function( params, displayId ) {
  "use strict";

  var utils = RiseVision.Common.Utilities,
    riseCache = RiseVision.Common.RiseCache,
    _initialLoad = true;

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.querySelector( "rise-storage" );

    storage.addEventListener( "rise-storage-response", function( e ) {
      var url;

      if ( e.detail && e.detail.url ) {

        url = e.detail.url.replace( "'", "\\'" );

        if ( _initialLoad ) {
          _initialLoad = false;

          RiseVision.Image.onFileInit( url );
        } else {
          // check for "changed" property
          if ( e.detail.hasOwnProperty( "changed" ) ) {
            if ( e.detail.changed ) {
              RiseVision.Image.onFileRefresh( url );
            } else {
              // in the event of a network failure and recovery, check if the Widget is in a state of storage error
              if ( RiseVision.Image.hasStorageError() ) {
                // proceed with refresh logic so the Widget can eventually play video again from a network recovery
                RiseVision.Image.onFileRefresh( e.detail.url );
              }
            }
          }
        }
      }
    } );

    storage.addEventListener( "rise-storage-api-error", function( e ) {
      var params = {
        "event": "error",
        "event_details": "storage api error",
        "error_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "Sorry, there was a problem communicating with Rise Storage." );
    } );

    storage.addEventListener( "rise-storage-no-file", function( e ) {
      var params = {
          "event": "error",
          "event_details": "storage file not found",
          "file_url": e.detail
        },
        img = document.getElementById( "image" );

      // clear the existing image
      img.style.background = "";

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "The selected image does not exist or has been moved to Trash." );
    } );

    storage.addEventListener( "rise-storage-file-throttled", function( e ) {
      var params = {
        "event": "error",
        "event_details": "storage file throttled",
        "file_url": e.detail
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "The selected image is temporarily unavailable." );
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "error",
        "event_details": "storage subscription error",
        "error_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Image.logEvent( params, true );
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = {
        "event": "error",
        "event_details": "storage subscription expired"
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "Rise Storage subscription is not active." );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var fileUrl = ( e.detail && e.detail.request && e.detail.request.url ) ? e.detail.request.url : null,
        params = {
          "event": "error",
          "event_details": "rise storage error",
          "error_details": "The request failed with status code: " + e.detail.error.currentTarget.status,
          "file_url": fileUrl
        };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "Sorry, there was a problem communicating with Rise Storage.", true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var fileUrl = ( e.detail && e.detail.request && e.detail.request.url ) ? e.detail.request.url : null,
        params = {
          "event": "error",
          "event_details": "rise cache error",
          "error_details": e.detail.error.message,
          "file_url": fileUrl
        },
        statusCode = 0,
        errorMessage;

      // log the error
      RiseVision.Image.logEvent( params, true );

      if ( riseCache.isV2Running() ) {
        errorMessage = riseCache.getErrorMessage( statusCode );
      } else {
        // Show a different message if there is a 404 coming from rise cache
        if ( e.detail.error.message ) {
          statusCode = +e.detail.error.message.substring( e.detail.error.message.indexOf( ":" ) + 2 );
        }

        errorMessage = utils.getRiseCacheErrorMessage( statusCode );
      }

      // show the error
      RiseVision.Image.showError( errorMessage );
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "error",
        "event_details": "rise cache not running",
        "error_details": ""
      };

      if ( e.detail ) {
        if ( e.detail.error ) {
          // storage v1
          params.error_details = e.detail.error.message;
        } else if ( e.detail.resp && e.detail.resp.error ) {
          // storage v2
          params.error_details = e.detail.resp.error.message;
        }
      }

      RiseVision.Image.logEvent( params, true );

      if ( e.detail && e.detail.isPlayerRunning ) {
        RiseVision.Image.showError( "Waiting for Rise Cache", true );
      }
    } );

    storage.addEventListener( "rise-cache-file-unavailable", function() {
      RiseVision.Image.onFileUnavailable( "File is downloading" );
    } );

    storage.setAttribute( "folder", params.storage.folder );
    storage.setAttribute( "fileName", params.storage.fileName );
    storage.setAttribute( "companyId", params.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "env", config.STORAGE_ENV );
    storage.go();
  }

  function retry() {
    var storage = document.querySelector( "rise-storage" );

    if ( !storage ) {
      return;
    }

    storage.go();
  }

  return {
    "init": init,
    "retry": retry
  };
};

/* global config, _ */

var RiseVision = RiseVision || {};

RiseVision.Image = RiseVision.Image || {};

RiseVision.Image.StorageFolder = function( data, displayId ) {
  "use strict";

  var utils = RiseVision.Common.Utilities,
    riseCache = RiseVision.Common.RiseCache,
    _isLoading = true,
    _files = [],
    _timer = null;

  function processUrl( e ) {
    var file;

    if ( e.detail ) {

      // Image has been added.
      if ( e.detail.added ) {
        _files.push( {
          "name": e.detail.name,
          "url": e.detail.url
        } );
      }

      // Image has been changed.
      if ( e.detail.changed ) {
        file = _.find( _files, function( file ) {
          return file.name === e.detail.name;
        } );

        file.url = e.detail.url;
      }

      // Image has been deleted.
      if ( e.detail.deleted ) {
        _files = _.reject( _files, function( file ) {
          return file.name === e.detail.name;
        } );
      }
    }

    _files = _.sortBy( _files, function( file ) {
      return file.name.toLowerCase();
    } );
  }

  function handleResponse( e ) {
    processUrl( e );

    // Image has been added.
    if ( e.detail.added ) {
      if ( _isLoading ) {
        // Need to wait for at least 2 images to load before initializing the slider.
        // Otherwise, the revolution.slide.onchange event will never fire, and this event is used
        // to check whether or not the slider should refresh.
        if ( _files.length > 1 ) {
          _isLoading = false;

          clearTimeout( _timer );
          RiseVision.Image.onFileInit( _files );
        } else {
          // Set a timeout in case there is only one image in the folder.
          _timer = setTimeout( function() {
            _isLoading = false;
            RiseVision.Image.onFileInit( _files );
          }, 5000 );
        }

        return;
      }
    }

    // Unchanged
    if ( e.detail.hasOwnProperty( "changed" ) && !e.detail.changed ) {
      // in the event of a network failure and recovery, check if the Widget is in a state of storage error
      if ( !RiseVision.Image.hasStorageError() ) {
        // only proceed with refresh logic below if there's been a storage error, otherwise do nothing
        // this is so the Widget can eventually play slideshow again from a network recovery
        return;
      }
    }

    RiseVision.Image.onFileRefresh( _files );
  }

  /*
   *  Public Methods
   */
  function init() {
    var storage = document.querySelector( "rise-storage" );

    storage.addEventListener( "rise-storage-response", handleResponse );

    storage.addEventListener( "rise-storage-api-error", function( e ) {
      var params = {
        "event": "error",
        "event_details": "storage api error",
        "error_details": "Response code: " + e.detail.code + ", message: " + e.detail.message
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "Sorry, there was a problem communicating with Rise Storage." );
    } );

    storage.addEventListener( "rise-storage-empty-folder", function() {
      var params = {
        "event": "error",
        "event_details": "storage folder empty"
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "The selected folder does not contain any images." );
    } );

    storage.addEventListener( "rise-storage-no-folder", function( e ) {
      var params = {
        "event": "error",
        "event_details": "storage folder doesn't exist",
        "error_details": e.detail
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "The selected folder does not exist or has been moved to Trash." );
    } );


    storage.addEventListener( "rise-storage-folder-invalid", function() {
      var params = {
        "event": "error",
        "event_details": "storage folder format(s) invalid"
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "The selected folder does not contain any supported image formats." );
    } );

    storage.addEventListener( "rise-storage-subscription-error", function( e ) {
      var params = {
        "event": "error",
        "event_details": "storage subscription error",
        "error_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Image.logEvent( params, true );
    } );

    storage.addEventListener( "rise-storage-subscription-expired", function() {
      var params = {
        "event": "error",
        "event_details": "storage subscription expired"
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "Rise Storage subscription is not active." );
    } );

    storage.addEventListener( "rise-storage-error", function( e ) {
      var params = {
        "event": "rise storage error",
        "event_details": "The request failed with status code: " + e.detail.error.currentTarget.status
      };

      RiseVision.Image.logEvent( params, true );
      RiseVision.Image.showError( "Sorry, there was a problem communicating with Rise Storage.", true );
    } );

    storage.addEventListener( "rise-cache-error", function( e ) {
      var params = {
          "event": "rise cache error",
          "event_details": e.detail.error.message
        },
        statusCode = 0,
        errorMessage;

      RiseVision.Image.logEvent( params, true );

      if ( riseCache.isV2Running() ) {
        errorMessage = riseCache.getErrorMessage( statusCode );
      } else {
        // Show a different message if there is a 404 coming from rise cache
        if ( e.detail.error.message ) {
          statusCode = +e.detail.error.message.substring( e.detail.error.message.indexOf( ":" ) + 2 );
        }

        errorMessage = utils.getRiseCacheErrorMessage( statusCode );
      }

      RiseVision.Image.showError( errorMessage );
    } );

    storage.addEventListener( "rise-cache-not-running", function( e ) {

      var params = {
        "event": "error",
        "event_details": "rise cache not running",
        "error_details": ""
      };

      if ( e.detail ) {
        if ( e.detail.error ) {
          // storage v1
          params.error_details = e.detail.error.message;
        } else if ( e.detail.resp && e.detail.resp.error ) {
          // storage v2
          params.error_details = e.detail.resp.error.message;
        }
      }

      RiseVision.Image.logEvent( params, true );

      if ( e.detail && e.detail.isPlayerRunning ) {
        RiseVision.Image.showError( "Waiting for Rise Cache", true );
      }
    } );

    storage.setAttribute( "fileType", "image" );
    storage.setAttribute( "companyId", data.storage.companyId );
    storage.setAttribute( "displayId", displayId );
    storage.setAttribute( "folder", data.storage.folder );
    storage.setAttribute( "env", config.STORAGE_ENV );

    storage.go();
  }

  return {
    "init": init
  };
};

var RiseVision = RiseVision || {};

RiseVision.Image = RiseVision.Image || {};

RiseVision.Image.NonStorage = function( data ) {
  "use strict";

  var riseCache = RiseVision.Common.RiseCache,
    utils = RiseVision.Common.Utilities,
    // 5 minutes
    _refreshDuration = 300000,
    _refreshIntervalId = null,
    _isLoading = true,
    _url = "";

  function _getFile( omitCacheBuster ) {
    var params;

    riseCache.getFile( _url, function( response, error ) {
      var statusCode = 0,
        errorMessage;

      if ( !error ) {

        if ( _isLoading ) {
          _isLoading = false;

          RiseVision.Image.onFileInit( response.url );

          // start the refresh interval
          _startRefreshInterval();

        } else {
          RiseVision.Image.onFileRefresh( response.url );
        }

      } else {

        if ( error.message && error.message === "File is downloading" ) {
          RiseVision.Image.onFileUnavailable( error.message );
        } else {

          // error occurred
          params = {
            "event": "error",
            "event_details": "non-storage error",
            "error_details": error.message,
            "file_url": response.url
          };

          RiseVision.Image.logEvent( params, true );

          if ( riseCache.isV2Running() ) {
            errorMessage = riseCache.getErrorMessage( statusCode );
          } else {
            // Show a different message if there is a 404 coming from rise cache
            if ( error.message ) {
              statusCode = +error.message.substring( error.message.indexOf( ":" ) + 2 );
            }

            errorMessage = utils.getRiseCacheErrorMessage( statusCode );
          }

          RiseVision.Image.showError( errorMessage );
        }
      }
    }, omitCacheBuster );
  }

  function _startRefreshInterval() {
    if ( _refreshIntervalId === null ) {
      _refreshIntervalId = setInterval( function() {
        _getFile( true );
      }, _refreshDuration );
    }
  }

  /*
   *  Public Methods
   */
  function init() {
    // Handle pre-merge use of "url" setting property
    _url = ( data.url && data.url !== "" ) ? data.url : data.selector.url;

    _url = utils.addProtocol( _url );

    _getFile( true );
  }

  return {
    "init": init
  };
};

var RiseVision = RiseVision || {};

RiseVision.Image = RiseVision.Image || {};

RiseVision.Image.LocalStorageFile = function() {
  "use strict";

  var wsClient = RiseVision.Common.WSClient,
    testGCSImage = "local-storage-test/test-1x1.png",
    watchMessageAlreadySent = false,
    testImageLoadAttempted = false;

  function _clientListHandler( message ) {
    var clients = message.clients;

    if ( !watchMessageAlreadySent ) {
      if ( clients.includes( "local-storage" ) ) {
        // log that LS is present
        RiseVision.Image.logEvent( {
          "event": "LS is present",
          "file_url": testGCSImage
        } );

        // send test WATCH for test image file on GCS bucket configured with Pub/Sub
        wsClient.broadcastMessage( {
          "topic": "WATCH",
          "filePath": testGCSImage
        } );

        watchMessageAlreadySent = true;
      } else {
        // log that LS is not present (yet)
        RiseVision.Image.logEvent( {
          "event": "LS is not present",
          "file_url": testGCSImage
        } );
      }
    }
  }

  function _fileUpdateHandler( message ) {
    var imgTest = null;

    if ( !message.filePath || message.filePath !== testGCSImage ) {
      return;
    }

    // log successful test of receiving FILE-UPDATE message
    RiseVision.Image.logEvent( {
      "event": "Test image FILE-UPDATE",
      "event_details": JSON.stringify( message ),
      "file_url": message.filePath
    } );

    // test downloading the image
    if ( !testImageLoadAttempted && message.status && message.status === "CURRENT" ) {
      imgTest = new Image();

      imgTest.onload = function() {
        RiseVision.Image.logEvent( {
          "event": "Test image loaded",
          "file_url": message.ospath
        } );
      };

      imgTest.onerror = function( err ) {
        RiseVision.Image.logEvent( {
          "event": "Test image load failed",
          "event_details": JSON.stringify( err ),
          "file_url": message.ospath
        } );
      };

      RiseVision.Image.logEvent( {
        "event": "Attempt test image load",
        "file_url": message.ospath
      } );

      imgTest.src = "file://" + message.ospath;
      testImageLoadAttempted = true;
    }
  }

  function _fileErrorHandler( message ) {
    RiseVision.Image.logEvent( {
      "event": "Test image FILE-ERROR",
      "event_details": JSON.stringify( message ),
      "file_url": message.filePath
    } );
  }

  function init() {
    if ( wsClient.canConnect() ) {

      wsClient.receiveMessages( function( message ) {
        if ( !message || !message.topic ) {
          RiseVision.Image.logEvent( {
            "event": "Invalid LMS message received",
            "event_details": JSON.stringify( message ),
            "file_url": testGCSImage
          } );

          return;
        }

        switch ( message.topic.toUpperCase() ) {
        case "CLIENT-LIST":
          return _clientListHandler( message );
        case "FILE-UPDATE":
          return _fileUpdateHandler( message );
        case "FILE-ERROR":
          return _fileErrorHandler( message );
        }
      } );

      wsClient.getModuleClientList();
    }
  }

  return {
    "init": init
  };
};

/* global RiseVision, gadgets, config, version */
( function( window, document, gadgets ) {
  "use strict";

  var id = new gadgets.Prefs().getString( "id" );

  window.oncontextmenu = function() {
    return false;
  };

  document.body.onmousedown = function() {
    return false;
  };

  function configure( names, values ) {
    var additionalParams,
      mode,
      companyId = "",
      displayId = "";

    if ( Array.isArray( names ) && names.length > 0 && Array.isArray( values ) && values.length > 0 ) {
      // company id
      if ( names[ 0 ] === "companyId" ) {
        companyId = values[ 0 ];
      }

      // display id
      if ( names[ 1 ] === "displayId" ) {
        if ( values[ 1 ] ) {
          displayId = values[ 1 ];
        } else {
          displayId = "preview";
        }
      }

      // provide LoggerUtils the ids to use
      RiseVision.Common.LoggerUtils.setIds( companyId, displayId );
      RiseVision.Common.LoggerUtils.setVersion( version );

      // additional params
      if ( names[ 2 ] === "additionalParams" ) {
        additionalParams = JSON.parse( values[ 2 ] );

        if ( Object.keys( additionalParams.storage ).length !== 0 ) {
          // storage file or folder selected
          if ( !additionalParams.storage.fileName ) {
            // folder was selected
            mode = "folder";
          } else {
            // file was selected
            mode = "file";
          }
        } else {
          // non-storage file was selected
          mode = "file";
        }

        RiseVision.Image.setAdditionalParams( additionalParams, mode, displayId );
      }
    }
  }

  function pause() {
    RiseVision.Image.pause();
  }

  function play() {
    RiseVision.Image.play();
  }

  function stop() {
    RiseVision.Image.stop();
  }

  function init() {
    if ( id && id !== "" ) {
      gadgets.rpc.register( "rscmd_play_" + id, play );
      gadgets.rpc.register( "rscmd_pause_" + id, pause );
      gadgets.rpc.register( "rscmd_stop_" + id, stop );
      gadgets.rpc.register( "rsparam_set_" + id, configure );
      gadgets.rpc.call( "", "rsparam_get", null, id, [ "companyId", "displayId", "additionalParams" ] );
    }
  }

  // check which version of Rise Cache is running and dynamically add rise-storage dependencies
  RiseVision.Common.RiseCache.isRCV2Player( function( isV2 ) {
    var fragment = document.createDocumentFragment(),
      link = document.createElement( "link" ),
      webcomponents = document.createElement( "script" ),
      href = config.COMPONENTS_PATH + ( ( isV2 ) ? "rise-storage-v2" : "rise-storage" ) + "/rise-storage.html",
      storage = document.createElement( "rise-storage" ),
      storageReady = false,
      polymerReady = false;

    function onPolymerReady() {
      window.removeEventListener( "WebComponentsReady", onPolymerReady );
      polymerReady = true;

      if ( storageReady && polymerReady ) {
        init();
      }
    }

    function onStorageReady() {
      storage.removeEventListener( "rise-storage-ready", onStorageReady );
      storageReady = true;

      if ( storageReady && polymerReady ) {
        init();
      }
    }

    webcomponents.src = config.COMPONENTS_PATH + "webcomponentsjs/webcomponents-lite.min.js";
    window.addEventListener( "WebComponentsReady", onPolymerReady );

    // add the webcomponents polyfill source to the document head
    document.getElementsByTagName( "head" )[ 0 ].appendChild( webcomponents );

    link.setAttribute( "rel", "import" );
    link.setAttribute( "href", href );

    // add the rise-storage <link> element to document head
    document.getElementsByTagName( "head" )[ 0 ].appendChild( link );

    storage.setAttribute( "refresh", 5 );

    if ( isV2 ) {
      storage.setAttribute( "usage", "widget" );
    }

    storage.addEventListener( "rise-storage-ready", onStorageReady );
    fragment.appendChild( storage );

    // add the <rise-storage> element to the body
    document.body.appendChild( fragment );
  } );

} )( window, document, gadgets );

/* jshint ignore:start */
var _gaq = _gaq || [];

_gaq.push(['_setAccount', 'UA-57092159-3']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = ('https:' == document.location.protocol ? 'https://ssl' : 'http://www') + '.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();
/* jshint ignore:end */
