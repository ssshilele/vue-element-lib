<template>
  <el-select ref="select" class="filter-selector" v-model="select_value" :disabled="disabled"
             v-on="customListeners" v-scroll-load="scrollOption"
             :filterable="filterable || remote" :filter-method="filterFilterMethod" :value-key="optionKey"
             :remote="remote" :remote-method="remoteFilterMethod" :automatic-dropdown="automaticDropdown"
             :loading="select_loading" :loading-text="loadingText"
             :clearable="clearable" :multiple="multiple" :collapse-tags="collapseTags"
             :style="{width: getInputWidth(inputWidth)}" :size="size" :placeholder="placeholder"
             :no-match-text="noMatchText" :no-data-text="noDataText" :popper-append-to-body="popperAppendToBody"
             :multiple-limit="multipleLimit" :reserve-keyword="reserveKeyword" :default-first-option="defaultFirstOption"
             :allow-create="allowCreate" :autocomplete="autocomplete" :name="name" :popper-class="popperClass">
    <p class="custom-option" v-show="remoteLoading && !direction">{{loadingText}}</p>
    <el-option v-for="(option, index) in select_options" :key="getOption('key', option) + index" :disabled="option.disabled"
               :value="getOption('value', option)" :label="getOption('label', option)">
    </el-option>
    <p class="custom-option" v-show="remoteLoading && direction">{{loadingText}}</p>
  </el-select>
</template>

<script>

// 本组件不支持 <el-option-group> 分组功能、<slot> 插槽功能

export default {
  // 自定义 v-model 指令，用于实现 value 的双向数据绑定
  // 初始化时 value 会被传递给 select_value，之后根据 watch 实时改变
  // 而当本组件发生 change 事件并附带一个新的值时，value 会被更新
  model: {
    prop: 'value',
    event: 'change'
  },
  props: {
    value: [String, Number, Boolean, Array, Object],

    /* options 是下拉框选项列表数据，形式为以下三种形式的数组（其中 option 是 options 数组中的任一项）：

      1. option 是基本类型数据，如 [option1, option2, ...]。
      此时，选项的值、显示文本均对应为 option 本身

      2. option 是 Object 类型，且它们都具有 value 和 label 属性。如 [{value: xxx, label: xxx}, ...]。
      此时，选项的值、显示文本会默认分别对应于 option 的 value、label 属性

      3. option 是 Object 类型，但它们不具有 value 和 label 属性（至少有一个不具有）。如 [{key1: xxx, key2: xxx}, ...]。
      此时，若 option 中缺少 value 属性，则需要通过 valueKey 显式指定选项的值；
           若 option 中缺少 label 属性，则可以通过 labelKey 显式指定选项的显示文本，若依然不指定，则显示文本默认等同于选项的值

      以上三种形式，我们都默认了 el-select 绑定的值是基本类型的。若需要绑定 Object 类型值时，还需手动指定 optionKey，作为绑定值的唯一标识。
      同时，通过 labelKey 指定选项的显示文本（option 中不存在 label 属性的情况下）。
    */
    options: Array,
    scrollPage: { type: Boolean, default: false }, // 是否启用滚动分页
    biDirection: { type: Boolean, default: false }, // 是否双向滚动

    limitPages: { type: Number, default: 4 }, // 允许最多同时显示多少页的数据（仅在双向滚动时有效）
    pageSize: { type: Number, default: 50 }, // 如需滚动分页，则可以指定 pageSize（默认 50），表示每页数据条数
    optionKey: String, // 存在，则表示 el-select 绑定的值是 Object 类型
    valueKey: { type: String, default: 'value' },
    labelKey: { type: String, default: 'label' }, // label 应当是 String 类型，以便于用户进行输入搜索

    disabled: { type: Boolean, default: false },
    // 若没有定义 filterMethod，则默认找出所有 label 属性（<el-option> 的 label 属性最终拿到的值）包含输入值的选项
    filterable: { type: Boolean, default: true }, // remote 存在时默认为 true
/*
    // 自定义搜索逻辑，在输入值改变时调用，参数为当前输入值（搜过结果通过手动改变 options 体现）
    filterMethod: Function,
*/
    // 开启远程搜索需要同时设置 filterable、scrollPage、remote 和 remoteMethod
    remote: { type: Boolean, default: false },
    // 远程搜索方法（Promise 对象，要求能够在其 then 方法中直接获取到可以展示的结果）
    // 在输入值改变时调用，参数为当前输入值（搜过结果通过手动改变 options 体现）
    remoteMethod: { author: Promise },
    automaticDropdown: { type: Boolean, default: true }, // 是否在 select 获得焦点时自动弹出选项菜单
    loading: { type: Boolean, default: false },
    loadingText: { type: String, default: '加载中...' },
    clearable: { type: Boolean, default: true },
    multiple: { type: Boolean, default: false },
    collapseTags: { type: Boolean, default: false },

    size: {
      type: String,
      default: 'small',
      validator (value) {
        return ['medium', 'small', 'mini'].includes(value.toLowerCase())
      }
    },
    placeholder: { type: String, default: '请选择搜索项' },
    inputWidth: [String, Number],

    waitTime: { type: Number, default: 300 },

    noMatchText: { type: String, default: '无匹配数据' },
    noDataText: { type: String, default: '无数据' },
    popperAppendToBody: { type: Boolean, default: true },
    multipleLimit: { type: Number, default: 0 },
    reserveKeyword: { type: Boolean, default: false },
    defaultFirstOption: { type: Boolean, default: false },
    allowCreate: { type: Boolean, default: false },
    autocomplete: { type: String, default: 'off' },
    name: String,
    popperClass: String
  },
  data () {
    return {
      select_value: this.value,
      select_options: this.options || [],
      select_loading: this.loading,

      scrollOption: {
        selector: '.filter-selector .el-select-dropdown__wrap',
        distance: 50,
        biDirection: true,
        method: this.scrollLoadMore
      },

      query: '',
      direction: true,
      pageIndex: 1,
      pages: [],

      timeoutId: null,
      rowHeight: 34,

      remoteLoading: false
    }
  },
  watch: {
    value () {
      this.select_value = this.value
    },
    loading () {
      this.select_loading = this.loading
    },
    select_loading () {
      this.$emit('update:loading', this.select_loading)
    },
    options: {
      handler  () {
        this.initData()
      },
      immediate: true
    }
  },
  computed: {
    customListeners () {
      const _this = this;
      return {
        ...this.$listeners,
        change (currentValue) {
          _this.$emit('change', currentValue)
        },
        'visible-change' (visible) {
          _this.$emit('visible-change', visible)
        },
        'remove-tag' (tag) {
          _this.$emit('remove-tag', tag)
        },
        clear () {
          _this.clear();
          _this.$emit('clear')
        },
        focus (event) {
          if (_this.remote) {
            // 后端分页时，首次点击自动加载第一页数据
            _this.select_loading = true;
            _this.initData();
          }
          _this.$emit('focus', event)
        },
        blur (event) {
          _this.$emit('blur', event)
        }
      }
    }
  },
  methods: {
    filterFilterMethod (query) {
      if (this.remote) return; // 非远程分页才有用
      this.query = query.trim(); // 缓存当前输入的查询字符串
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(this.initData, this.waitTime) // 连续输入防抖动
    },
    remoteFilterMethod (query) {
      if (!this.remote) return; // 远程分页才有用
      this.query = query.trim(); // 缓存当前输入的查询字符串
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        this.select_loading = true;
        this.initData()
      }, this.waitTime) // 连续输入防抖动
    },
    initData () {
      this.pageIndex = 1;
      this.pages = [1];
      if (this.remote) {
        this.remotePageData()
          .then(data => { this.select_options = data })
      } else {
        this.select_options = this.scrollPage ? this.pageData() : this.filterData()
      }
    },
    scrollLoadMore (direction, bindElement) {
      clearTimeout(this.timeoutId);
      if (this.remote ? this.remoteLoading : !this.scrollPage) return; // 正在远程加载（远程肯定分页），或没有启用滚动分页
      this.timeoutId = setTimeout(() => {
        this.direction = direction;
        if (!this.biDirection) {
          if (direction) {
            // 单向（向下）滚动，把新一页数据填充到原数据列表后面
            this.pageIndex++;
            if (this.remote) {
              this.remotePageData({ bindElement })
                .then(data => { this.select_options = this.select_options.concat(data) })
            } else {
              this.select_options = this.select_options.concat(this.pageData())
            }
          }
        } else {
          // 双向滚动，每次只展示不超过 limitPages 页的数据
          if (direction) {
            // 向下滚动
            const end = this.pages[this.pages.length - 1]; // focus on 时 initData 方法已经加载了第一页
            if (this.remote) {
              this.remotePageData({ pageIndex: end + 1, bindElement })
                .then(data => { this.scrollDownLoad(data, bindElement, end) })
            } else {
              const data = this.pageData(end + 1);
              this.scrollDownLoad(data, bindElement, end)
            }
          } else {
            // 向上滚动
            if (this.pages[0] > 1) {
              // 尚未达到首页，尾部出，头部入
              this.pageIndex = this.pages[0] - 1;
              if (this.remote) {
                // 该页数据肯定存在，无需判断
                // 也不需要为了显示 加载中... 而调整 bindElement.scrollTop。因为它就在第一行，加进去更新后就能看到
                this.remotePageData()
                  .then(data => { this.scrollUpLoad(data, bindElement) })
              } else {
                const data = this.pageData();
                this.scrollUpLoad(data, bindElement)
              }
            }
            // 达到首页，不做任何处理
          }
        }
      }, this.waitTime) // 连续滚动防抖动
    },
    scrollDownLoad (data, bindElement, end) {
      if (!data.length) return; // 先查看是否存在新一页数据，若存在，再处理
      if (this.pages.length >= this.limitPages && data.length) {
        // 达到最大页数，头部出
        this.pages.shift();
        this.select_options.splice(0, this.pageSize);
        // 由于始终展示 limitPages 页数据，所以 scrollHeight 等没有变化，滚动条一直处于下拉框底部
        // 容易给用户造成数据已经加载完毕的错觉
        // 故，手动的将滚动距离调整到原最后一个数据应该在的位置
        bindElement.scrollTop -= bindElement.scrollHeight / this.limitPages
      }
      // 尾部入（包括初始时未达到最大页数的情况）
      this.pageIndex = end + 1;
      this.pages.push(this.pageIndex);
      this.select_options = this.select_options.concat(data);
      console.log(this.pages)
    },
    scrollUpLoad (data, bindElement) {
      this.pages.pop();
      this.select_options.splice(-this.pageSize, this.pageSize);
      this.pages.unshift(this.pageIndex);
      this.select_options = data.concat(this.select_options);
      // 同上，手动的将滚动距离调整到原第一个数据应该在的位置
      bindElement.scrollTop += bindElement.scrollHeight / this.pages.length
      console.log(this.pages)
    },
    pageData (pageIndex) {
      const data = this.filterData();
      const page = pageIndex || this.pageIndex;
      const start = (page - 1) * this.pageSize;
      let end = page * this.pageSize;
      if (end >= data.length) {
        // 最后一页，没有更多数据了
        end = data.length;
      }
      return data.slice(start, end)
    },
    filterData () {
      if (!Array.isArray(this.options)) return [];
      if (!this.query) return this.options.concat();
      return this.options.filter(item => {
        const label = this.getOption('label', item);
        return label.toLowerCase().includes(this.query.toLowerCase())
      })
    },
    async remotePageData (params) {
      this.remoteLoading = true;
      console.log(params)
      if (params && params.bindElement) {
        this.$nextTick(() => {
          params.bindElement.scrollTop += this.rowHeight; // 稍微向下偏一点，把 加载中... 显示出来
        })
      }
      const page = params && params.pageIndex ? params.pageIndex : this.pageIndex;
      const data = await this.remoteMethod(this.query, page, this.pageSize);
      this.remoteLoading = false;
      this.select_loading = false; // focus on 时首次加载会开启
      return Promise.resolve(data)
    },

    getOption (type, option) {
      if (type === 'value') {
        // 若 optionKey 存在，表明选项值为 option 对象
        if (this.optionKey) return option;
        // 否则，若 option[valueKey || 'value'] 存在，则使用 option[valueKey || 'value']
        // 否则，使用 option 本身
        return this.valueKey && option.hasOwnProperty(this.valueKey) ? option[this.valueKey] : option
      } else {
        // 若 optionKey 存在，则 key 为 String(option[optionKey])
        // 否则，若 option[valueKey || 'value'] 存在，则 key 为 String(option[valueKey || 'value'])
        // 否则，使用 String(option)
        const key = this.optionKey && option.hasOwnProperty(this.optionKey) ? String(option[this.optionKey])
          : this.valueKey && option.hasOwnProperty(this.valueKey) ? String(option[this.valueKey])
            : String(option);
        if (type === 'key') return key;
        else if (type === 'label') {
          // 若 option[labelKey || label] 存在，则使用 String(option[labelKey || label])
          // 否则，使用 key
          return this.labelKey && option.hasOwnProperty(this.labelKey) ? String(option[this.labelKey]) : key
        } else return option
      }
    },
    getInputWidth (inputWidth) {
      return typeof inputWidth === 'number' && inputWidth >= 0
        ? inputWidth + 'px' : typeof inputWidth === 'string' ? inputWidth : ''
    },

    // 可从父组件中调用本组件的 focus/blur 方法，实现 <el-select> 的聚焦/失焦
    focus () {
      this.$refs.select.focus()
    },
    blur () {
      this.$refs.select.blur()
    },
    clear () {
      this.query = ''; // 清除上次的查询字符串和查询结果
      this.initData();
    }
  }
}
</script>

<style scoped>
  .custom-option{
    color: #909399;
    height: 34px;
    line-height: 34px;
    padding: 0 20px;
    margin: 0;
    font-size: 14px;
    text-align: center;
  }
</style>
