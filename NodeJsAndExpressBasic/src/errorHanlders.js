class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message)
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

class BadRequestError extends AppError {
    constructor(message = "Invalid Request") {
        super(message, 400)
    }
}

class UnauthorizedError extends AppError {
    constructor(message = "Unathorized"){
        super(message, 401)
    }
}

class NotFoundError extends AppError{
    constructor(message = "Not Found"){
        super(message, 404)
    }
}