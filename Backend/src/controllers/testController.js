const testData = require("../models/testModel");

const getTestMessage = (req, res) => {
  res.status(200).json(testData);
};

module.exports = {
  getTestMessage
};