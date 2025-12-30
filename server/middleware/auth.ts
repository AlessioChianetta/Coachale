import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { storage } from "../storage";

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: "consultant" | "client" | "super_admin";
    consultantId?: string;
    profileId?: string; // Email Condivisa feature: active profile ID
    encryptionSalt?: string; // Per-consultant encryption salt
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await storage.getUser(decoded.userId);
    
    if (!user) {
      return res.status(401).json({ message: 'Invalid token' });
    }

    // Email Condivisa feature: if JWT contains profileId, use profile's role
    let role = user.role;
    let consultantId = user.consultantId || undefined;
    let profileId: string | undefined = undefined;

    if (decoded.profileId) {
      const profile = await storage.getUserRoleProfileById(decoded.profileId);
      if (profile && profile.userId === user.id && profile.isActive) {
        role = profile.role;
        consultantId = profile.consultantId || user.consultantId || undefined;
        profileId = profile.id;
      }
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: role,
      consultantId: consultantId,
      profileId: profileId,
      encryptionSalt: user.encryptionSalt || undefined,
    };
    
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const requireRole = (role: "consultant" | "client" | "super_admin") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ message: `${role} access required` });
    }

    next();
  };
};

export const requireAnyRole = (roles: Array<"consultant" | "client" | "super_admin">) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied. Required role: ${roles.join(' or ')}` 
      });
    }

    next();
  };
};

export const requireSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }

  next();
};
