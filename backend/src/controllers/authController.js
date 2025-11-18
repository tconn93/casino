const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authController = {
  register: async (req, res) => {
    try {
      const { username, password, email } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const existingUser = await User.findByUsername(username);
      if (existingUser) {
        return res.status(409).json({ error: 'Username already exists' });
      }

      const user = await User.create(username, password, email);
      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
        expiresIn: '7d'
      });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          balance: user.balance
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  login: async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      const user = await User.findByUsername(username);
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPassword = User.verifyPassword(password, user.password);
      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET, {
        expiresIn: '7d'
      });

      const userWithBalance = await User.findById(user.id);

      res.json({
        token,
        user: {
          id: userWithBalance.id,
          username: userWithBalance.username,
          email: userWithBalance.email,
          balance: userWithBalance.balance
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  getProfile: async (req, res) => {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const stats = await User.getStats(user.id);

      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        balance: user.balance,
        stats
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = authController;
