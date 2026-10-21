const express = require('express');
const { QualityResult, Contract } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const moment = require('moment');

const router = express.Router();

// 按类型分析数据
const analysisByType = async (req, res) => {
  try {
    const { type, hospital, startTime, endTime } = req.body;
    
    if (!type) {
      return res.status(400).json({
        err_code: 400,
        message: '缺少分析类型参数'
      });
    }

    // 获取用户ID（如果有）
    const userId = req.user?.id || null;

    // 构建查询条件
    const where = {};
    if (userId) {
      where.user_id = userId;
    }

    if (hospital && hospital !== '全部') {
      where.hospital = hospital;
    }

    if (startTime && endTime) {
      where.createdAt = {
        [Op.between]: [new Date(startTime), new Date(endTime)]
      };
    } else if (startTime) {
      where.createdAt = {
        [Op.gte]: new Date(startTime)
      };
    } else if (endTime) {
      where.createdAt = {
        [Op.lte]: new Date(endTime)
      };
    }

    let result;

    // 根据不同的分析类型执行不同的查询
    switch (type) {
      case 'contract_type':
        // 按合同类型统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            'contract_type',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['contract_type'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          name: item.contract_type || '未知类型',
          value: parseInt(item.dataValues.count)
        }));
        break;

      case 'hospital':
        // 按医院统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            'hospital',
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: ['hospital'],
          order: [[sequelize.fn('COUNT', sequelize.col('id')), 'DESC']]
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          name: item.hospital || '未知医院',
          value: parseInt(item.dataValues.count)
        }));
        break;

      case 'time_trend':
        // 按时间趋势统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d'), 'date'],
            [sequelize.fn('COUNT', sequelize.col('id')), 'count']
          ],
          group: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d')],
          order: [sequelize.fn('DATE_FORMAT', sequelize.col('createdAt'), '%Y-%m-%d')]
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          date: item.dataValues.date,
          count: parseInt(item.dataValues.count)
        }));
        break;

      case 'risk_count':
        // 按风险条款数量统计
        result = await QualityResult.findAll({
          where,
          attributes: [
            'id',
            'contract_name',
            [
              sequelize.literal(`(
                LENGTH(risk_clauses) - LENGTH(REPLACE(risk_clauses, '条款名称', ''))
              ) / LENGTH('条款名称')`),
              'risk_count'
            ]
          ],
          order: [[sequelize.literal('risk_count'), 'DESC']],
          limit: 10
        });
        
        // 转换为前端需要的格式
        result = result.map(item => ({
          contract_name: item.contract_name || `合同ID: ${item.id}`,
          risk_count: parseInt(item.dataValues.risk_count) || 0
        }));
        break;

      default:
        return res.status(400).json({
          err_code: 400,
          message: '不支持的分析类型'
        });
    }

    return res.status(200).json({
      err_code: 0,
      message: '分析成功',
      data: result
    });
  } catch (error) {
    console.error('数据分析失败:', error);
    return res.status(500).json({
      err_code: 500,
      message: '服务器错误，请稍后重试'
    });
  }
};

// 获取合同统计数据
const getContractStatistics = async (req, res) => {
  try {
    const { days = 30 } = req.query; // 默认获取30天的数据
    
    // 计算开始日期
    const startDate = moment().subtract(days, 'days').startOf('day');
    const endDate = moment().endOf('day');
    
    let reviewData = [];
    let draftData = [];
    let totalReview = 0;
    let totalDraft = 0;
    let todayReview = 0;
    let todayDraft = 0;
    
    try {
      // 合同审查数据：从 contracts 表查 contract_type = 'review'
      reviewData = await sequelize.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM contracts 
        WHERE created_at BETWEEN ? AND ? 
          AND contract_type = 'review'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `, {
        replacements: [startDate.toDate(), endDate.toDate()],
        type: sequelize.QueryTypes.SELECT
      });
      
      totalReview = await Contract.count({
        where: {
          contract_type: 'review',
          created_at: {
            [Op.between]: [startDate.toDate(), endDate.toDate()]
          }
        }
      });
      
      const todayStart = moment().startOf('day');
      const todayEnd = moment().endOf('day');
      
      todayReview = await Contract.count({
        where: {
          contract_type: 'review',
          created_at: {
            [Op.between]: [todayStart.toDate(), todayEnd.toDate()]
          }
        }
      });
      
      // 合同起草数据：从 contracts 表查 contract_type = 'draft'
      draftData = await sequelize.query(`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM contracts 
        WHERE created_at BETWEEN ? AND ? 
          AND contract_type = 'draft'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
      `, {
        replacements: [startDate.toDate(), endDate.toDate()],
        type: sequelize.QueryTypes.SELECT
      });
      
      totalDraft = await Contract.count({
        where: {
          contract_type: 'draft',
          created_at: {
            [Op.between]: [startDate.toDate(), endDate.toDate()]
          }
        }
      });
      
      todayDraft = await Contract.count({
        where: {
          contract_type: 'draft',
          created_at: {
            [Op.between]: [todayStart.toDate(), todayEnd.toDate()]
          }
        }
      });
      
    } catch (error) {
      console.error('查询统计数据失败:', error.message);
    }

    console.log('查询结果:', {
      reviewData: reviewData.length,
      draftData: draftData.length,
      totalReview,
      totalDraft,
      todayReview,
      todayDraft
    });

    // 生成完整的日期范围数据
    const dateRange = [];
    const currentDate = moment(startDate);
    
    while (currentDate.isSameOrBefore(endDate)) {
      dateRange.push(currentDate.format('YYYY-MM-DD'));
      currentDate.add(1, 'day');
    }

    // 处理审查数据，填充缺失的日期
    const processedReviewData = dateRange.map(date => {
      const found = reviewData.find(item => item.date === date);
      return {
        date,
        count: found ? parseInt(found.count) : 0
      };
    });

    // 处理起草数据，填充缺失的日期
    const processedDraftData = dateRange.map(date => {
      const found = draftData.find(item => item.date === date);
      return {
        date,
        count: found ? parseInt(found.count) : 0
      };
    });

    res.json({
      err_code: 0,
      message: '获取成功',
      data: {
        summary: {
          totalReview,
          totalDraft,
          todayReview,
          todayDraft
        },
        reviewData: processedReviewData,
        draftData: processedDraftData,
        dateRange
      }
    });

  } catch (error) {
    console.error('获取合同统计数据失败:', error);
    res.status(500).json({
      err_code: 500,
      message: '服务器错误: ' + error.message
    });
  }
};

module.exports = {
  router,
  analysisByType,
  getContractStatistics
}; 