const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// MySQL connection configuration
const dbConfig = {
  host: 'localhost',
  user: 'root',
  password: 'root',
};

// Initialize database and tables
async function initDatabase() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    
    // Create database if not exists
    await connection.query('CREATE DATABASE IF NOT EXISTS coact_ai_games');
    await connection.query('USE coact_ai_games');
    
    // Create employees table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS employees (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create game_scores table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS game_scores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        game_id VARCHAR(50) NOT NULL,
        score INT NOT NULL,
        best_score INT NOT NULL DEFAULT 0,
        attempts INT NOT NULL DEFAULT 0,
        total_score INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
        UNIQUE KEY unique_employee_game (employee_id, game_id)
      )
    `);
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

// Get database connection
async function getConnection() {
  const connection = await mysql.createConnection({
    ...dbConfig,
    database: 'coact_ai_games',
  });
  return connection;
}

// API Routes

// Get or create employee
app.post('/api/employees', async (req, res) => {
  console.log('POST /api/employees called with:', req.body);
  const { name } = req.body;
  if (!name || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name must be at least 2 characters' });
  }

  const connection = await getConnection();
  try {
    const [existing] = await connection.query('SELECT * FROM employees WHERE name = ?', [name.trim()]);
    console.log('Existing employee:', existing);
    
    if (existing.length > 0) {
      return res.json(existing[0]);
    }

    const [result] = await connection.query('INSERT INTO employees (name) VALUES (?)', [name.trim()]);
    const [newEmployee] = await connection.query('SELECT * FROM employees WHERE id = ?', [result.insertId]);
    console.log('Created new employee:', newEmployee);
    
    res.json(newEmployee[0]);
  } catch (error) {
    console.error('Error in /api/employees:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await connection.end();
  }
});

// Record score
app.post('/api/scores', async (req, res) => {
  console.log('POST /api/scores called with:', req.body);
  const { employeeName, gameId, score } = req.body;
  
  if (!employeeName || !gameId || typeof score !== 'number') {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const connection = await getConnection();
  try {
    const [employees] = await connection.query('SELECT * FROM employees WHERE name = ?', [employeeName]);
    console.log('Found employees:', employees);
    if (employees.length === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    const employee = employees[0];
    
    const [existing] = await connection.query(
      'SELECT * FROM game_scores WHERE employee_id = ? AND game_id = ?', 
      [employee.id, gameId]
    );
    console.log('Existing score:', existing);
    
    if (existing.length > 0) {
      const current = existing[0];
      const newBestScore = Math.max(current.best_score, score);
      const newTotalScore = current.total_score + score;
      const newAttempts = current.attempts + 1;
      console.log('Updating score:', { newBestScore, newTotalScore, newAttempts });
      
      await connection.query(
        'UPDATE game_scores SET score = ?, best_score = ?, total_score = ?, attempts = ? WHERE id = ?',
        [score, newBestScore, newTotalScore, newAttempts, current.id]
      );
    } else {
      console.log('Inserting new score');
      await connection.query(
        'INSERT INTO game_scores (employee_id, game_id, score, best_score, total_score, attempts) VALUES (?, ?, ?, ?, ?, ?)',
        [employee.id, gameId, score, score, score, 1]
      );
    }
    
    // Get updated scores
    const [updated] = await connection.query(
      'SELECT * FROM game_scores WHERE employee_id = ? AND game_id = ?', 
      [employee.id, gameId]
    );
    console.log('Updated score:', updated);
    
    res.json(updated[0]);
  } catch (error) {
    console.error('Error in /api/scores:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await connection.end();
  }
});

// Get leaderboard
app.get('/api/leaderboard', async (req, res) => {
  console.log('GET /api/leaderboard called with gameId:', req.query.gameId);
  const { gameId } = req.query;
  const connection = await getConnection();

  try {
    let leaderboardData;

    if (gameId) {
      const [rows] = await connection.query(`
        SELECT e.name, gs.best_score as score, gs.attempts
        FROM game_scores gs
        JOIN employees e ON gs.employee_id = e.id
        WHERE gs.game_id = ?
        ORDER BY gs.best_score DESC
        LIMIT 10
      `, [gameId]);
      leaderboardData = rows;
    } else {
      // Get overall + per game scores for each player
      const [employees] = await connection.query(`
        SELECT DISTINCT e.id, e.name
        FROM employees e
        JOIN game_scores gs ON e.id = gs.employee_id
        ORDER BY (SELECT SUM(total_score) FROM game_scores WHERE employee_id = e.id) DESC
        LIMIT 10
      `);

      // For each employee, get all their game scores
      leaderboardData = [];
      for (const emp of employees) {
        const [gameScores] = await connection.query(`
          SELECT game_id, best_score, total_score, attempts
          FROM game_scores
          WHERE employee_id = ?
        `, [emp.id]);

        const totalScore = gameScores.reduce((sum, gs) => sum + gs.total_score, 0);
        const totalAttempts = gameScores.reduce((sum, gs) => sum + gs.attempts, 0);

        leaderboardData.push({
          name: emp.name,
          score: totalScore,
          attempts: totalAttempts,
          games: gameScores
        });
      }
    }

    console.log('Leaderboard data:', leaderboardData);
    res.json(leaderboardData);
  } catch (error) {
    console.error('Error in /api/leaderboard:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await connection.end();
  }
});

// Get employee game stats
app.get('/api/employees/:name/games', async (req, res) => {
  const { name } = req.params;
  const connection = await getConnection();
  
  try {
    const [employees] = await connection.query('SELECT * FROM employees WHERE name = ?', [name]);
    if (employees.length === 0) {
      return res.json([]);
    }
    
    const [scores] = await connection.query(
      'SELECT game_id, best_score, attempts, total_score FROM game_scores WHERE employee_id = ?',
      [employees[0].id]
    );
    
    res.json(scores);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    await connection.end();
  }
});

// Start server
async function startServer() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

startServer();
