import "./MatchDetails.css";

export default function ResultsBoard({ match }) {
    const results = match?.results || [];
    
    if(!results.length) {
        return <p className="muted"> Results not published yet.</p>;
    }

    const sorted = [...results].sort((a,b) => b.kills - a.kills);

    return (
        <div className="results-board">
            <h3>Match Results</h3>

            <table>
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Username</th>
                        <th>Kills</th>
                        <th>Coins</th>
                    </tr>
                </thead>
                <tbody>
                    {sorted.map((p,i) =>(
                        <tr key={p.uid}>
                            <td>{i + 1}</td>
                            <td>{p.username}</td>
                            <td>{p.kills}</td>
                            <td>{p.coinsEarned}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}