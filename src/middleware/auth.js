import crypto from 'crypto';

export function basicAuth(req, res, next) {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const password = process.env.ADMIN_PASSWORD;
  
  if (!password) {
    return next();
  }
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    res.setHeader('WWW-Authenticate', 'Basic realm="TraceLink Admin"');
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  try {
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const firstColonIndex = credentials.indexOf(':');
    
    if (firstColonIndex === -1) {
      return res.status(401).json({ error: 'Invalid credentials format' });
    }
    
    const providedUsername = credentials.substring(0, firstColonIndex);
    const providedPassword = credentials.substring(firstColonIndex + 1);
    
    // Hash both username and password for constant-length timing-safe comparison
    const providedUsernameHash = crypto.createHash('sha256').update(providedUsername).digest();
    const expectedUsernameHash = crypto.createHash('sha256').update(username).digest();
    const usernameValid = crypto.timingSafeEqual(providedUsernameHash, expectedUsernameHash);

    const providedPasswordHash = crypto.createHash('sha256').update(providedPassword).digest();
    const expectedPasswordHash = crypto.createHash('sha256').update(password).digest();
    const passwordValid = crypto.timingSafeEqual(providedPasswordHash, expectedPasswordHash);
    
    if (usernameValid && passwordValid) {
      return next();
    }
  } catch (error) {
    console.error('Auth error:', error.message);
  }
  
  res.setHeader('WWW-Authenticate', 'Basic realm="TraceLink Admin"');
  return res.status(401).json({ error: 'Invalid credentials' });
}
