class ApiResponse {
  constructor(statusCode, data, message = API_RESPONSE_SUCCESS_MESSAGE) {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.status = statusCode < 400 ? "SUCCESS" : "ERROR";
  }
}

module.exports = ApiResponse;
