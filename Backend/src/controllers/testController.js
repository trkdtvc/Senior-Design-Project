const testData = require("../models/testModel");

const getTestMessage = (req, res) => {
  res.json(testData);
};

module.exports = {
  getTestMessage
};