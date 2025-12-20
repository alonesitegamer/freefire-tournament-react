import "./MatchDetails.css";
export default function PlayersBoard({ match }) {
  const players = match?.playersJoined || [];

  return (
    <div className="players-board">
      <h3>Players Joined ({players.length})</h3>

      {players.length === 0 ? (
        <p className="muted">No players joined yet.</p>
      ) : (
        <ul className="players-list">
          {players.map((p, i) => (
            <div key={p.uid}>
              <span className="rank">{i + 1}.</span>
              <span className="name">{p.userName || "player"}</span>
            </div>
          ))}
        </ul>
      )}
    </div>
  );
}
