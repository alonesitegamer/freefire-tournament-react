import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

// Tournament management and player dashboard
const Dashboard = () => {
  const [tournaments, setTournaments] = useState([]);
  const [joinedMatches, setJoinedMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const userId = localStorage.getItem('userId');

  // Fetch tournaments on component mount
  useEffect(() => {
    fetchTournaments();
  }, []);

  // Fetch all tournaments
  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/tournaments');
      setTournaments(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load tournaments');
      console.error('Fetch tournaments error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Join a match
  const joinMatch = async (matchId) => {
    if (!userId) {
      setError('Please log in to join matches');
      return;
    }

    try {
      const response = await axios.post('/api/matches/join', {
        matchId,
        userId
      });
      
      // Add the new match to joined matches
      setJoinedMatches([...joinedMatches, response.data.match]);
      setError(null);
      
      // Refresh tournaments to update availability
      await fetchTournaments();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to join match');
      console.error('Join match error:', err);
    }
  };

  // Leave a match
  const leaveMatch = async (matchId) => {
    try {
      await axios.post('/api/matches/leave', {
        matchId,
        userId
      });
      
      // Remove the match from joined matches
      setJoinedMatches(joinedMatches.filter(m => m.id !== matchId));
      setError(null);
      
      // Refresh tournaments
      await fetchTournaments();
    } catch (err) {
      setError('Failed to leave match');
      console.error('Leave match error:', err);
    }
  };

  if (loading) {
    return <div className="dashboard">Loading tournaments...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Tournament Dashboard</h1>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="tournaments-section">
        <h2>Available Tournaments</h2>
        {tournaments.length === 0 ? (
          <p>No tournaments available</p>
        ) : (
          <div className="tournaments-grid">
            {tournaments.map(tournament => (
              <div key={tournament.id} className="tournament-card">
                <h3>{tournament.name}</h3>
                <p>Prize Pool: ${tournament.prizePool}</p>
                <p>Players: {tournament.playerCount}</p>
                <button onClick={() => joinMatch(tournament.id)}>
                  Join Tournament
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <div className="joined-matches-section">
        <h2>Your Joined Matches</h2>
        {joinedMatches.length === 0 ? (
          <p>You haven't joined any matches yet</p>
        ) : (
          <div className="matches-list">
            {joinedMatches.map(match => (
              <div key={match.id} className="match-item">
                <h4>{match.name}</h4>
                <p>Status: {match.status}</p>
                <button onClick={() => leaveMatch(match.id)}>
                  Leave Match
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
