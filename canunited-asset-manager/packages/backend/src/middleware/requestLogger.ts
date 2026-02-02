import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const log = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('user-agent')?.substring(0, 50)
    };
    
    if (res.statusCode >= 400) {
      console.warn('Request warning:', log);
    } else if (process.env.NODE_ENV === 'development') {
      console.log('Request:', log);
    }
  });
  
  next();
}
