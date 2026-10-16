<template>
  <div class="markdown-content" v-html="renderedContent"></div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

interface Props {
  content: string;
}

const props = defineProps<Props>();

// 配置 marked
onMounted(() => {
  marked.setOptions({
    highlight: function(code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (err) {
          console.warn('代码高亮失败:', err);
        }
      }
      return hljs.highlightAuto(code).value;
    },
    breaks: true,
    gfm: true
  });
});

const renderedContent = computed(() => {
  if (!props.content) return '';
  try {
    return marked(props.content);
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return props.content;
  }
});
</script>

<style scoped>
.markdown-content {
  line-height: 1.3;
  color: #333;
  font-size: 14px;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-top: 0.5em;
  margin-bottom: -10px;
  font-weight: bold;
  color: #2c3e50;
  line-height: 1.3;
}

.markdown-content :deep(h1) {
  font-size: 1.25em;
  border-bottom: 1px solid #eee;
  padding-bottom: 0.1em;
}

.markdown-content :deep(h2) {
  font-size: 1.15em;
  border-bottom: 1px solid #f0f0f0;
  padding-bottom: 0.1em;
}

.markdown-content :deep(h3) {
  font-size: 1.1em;
}

.markdown-content :deep(p) {
  margin-bottom: -10px;
  line-height: 1.3;
}

.markdown-content :deep(ul),
.markdown-content :deep(ol) {
  margin-bottom: -10px;
  margin-top: -10px;
  padding-left: 1.2em;
  line-height: 1.3;
}

/* 特别处理p标签和ol标签之间的间距 */
.markdown-content :deep(p + ol),
.markdown-content :deep(p + ul) {
  margin-top: -15px;
}

.markdown-content :deep(ol + p),
.markdown-content :deep(ul + p) {
  margin-top: -15px;
}

.markdown-content :deep(li) {
  margin-bottom: -10px;
  line-height: 1.3;
}

.markdown-content :deep(blockquote) {
  border-left: 4px solid #ddd;
  padding-left: 1em;
  margin-bottom: -10px;
  color: #666;
  background-color: #f9f9f9;
  padding: 0.5em 1em;
  line-height: 1.3;
}

.markdown-content :deep(code) {
  background-color: #f1f1f1;
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.9em;
  line-height: 1.3;
}

.markdown-content :deep(pre) {
  background-color: #f8f8f8;
  border: 1px solid #ddd;
  border-radius: 5px;
  padding: 1em;
  overflow-x: auto;
  margin-bottom: -10px;
  line-height: 1.3;
}

.markdown-content :deep(pre code) {
  background-color: transparent;
  padding: 0;
  border-radius: 0;
  line-height: 1.3;
}

.markdown-content :deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin-bottom: -10px;
  line-height: 1.3;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid #ddd;
  padding: 0.5em;
  text-align: left;
  line-height: 1.3;
}

.markdown-content :deep(th) {
  background-color: #f2f2f2;
  font-weight: bold;
}

.markdown-content :deep(a) {
  color: #0066cc;
  text-decoration: none;
  line-height: 1.3;
}

.markdown-content :deep(a:hover) {
  text-decoration: underline;
}

.markdown-content :deep(strong) {
  font-weight: bold;
  line-height: 1.3;
}

.markdown-content :deep(em) {
  font-style: italic;
  line-height: 1.3;
}
</style>
