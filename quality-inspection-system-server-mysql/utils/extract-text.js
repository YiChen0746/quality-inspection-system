const mammoth = require('mammoth');
const PizZip = require('pizzip');
const xml2js = require('xml2js');

/**
 * 从docx文件buffer中提取文本内容
 * @param {Buffer} buffer docx文件的buffer
 * @returns {Promise<string>} 提取的文本内容
 */
const extractTextFromDocxBuffer = async (buffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (error) {
    console.error('提取文本失败:', error);
    throw error;
  }
};

/**
 * 从docx文件中提取结构化内容（包括样式信息）
 * @param {Buffer} buffer docx文件的buffer
 * @returns {Promise<Object>} 提取的结构化内容
 */
const extractStructuredContent = async (buffer) => {
  try {
    // 使用PizZip解压docx文件
    const zip = new PizZip(buffer);
    
    // 读取document.xml文件
    const content = zip.file('word/document.xml').asText();
    
    // 解析XML
    const parser = new xml2js.Parser({ explicitArray: false });
    const result = await parser.parseStringPromise(content);
    
    return result;
  } catch (error) {
    console.error('提取结构化内容失败:', error);
    throw error;
  }
};

module.exports = {
  extractTextFromDocxBuffer,
  extractStructuredContent
}; 