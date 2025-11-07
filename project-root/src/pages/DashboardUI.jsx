import React from 'react';
import { FaVolumeUp, FaVolumeMute, FaHistory, FaMoneyBillWave, FaGift, FaSignOutAlt, FaArrowLeft, FaUserEdit, FaUserCog } from "react-icons/fa";
import MatchHistoryPage from './MatchHistoryPage';
import WithdrawalHistoryPage from './WithdrawalHistoryPage';

// Helper function to format timestamps nicely
function formatMatchTime(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== 'function') {
    return "Time TBD";
  }
  return timestamp.toDate().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// This is just the UI. All the functions (the "props") are passed in from Dashboard.jsx
export default function DashboardUI(props) {
  const {
    profile,
    loading,
    activeTab,
    setActiveTab,
    topupAmount,
    setTopupAmount,
    requests,
    selectedAmount,
    setSelectedAmount,
    matches,
    loadingMatches,
    newMatch,
    isPlaying,
    audioRef,
    accountView,
    setAccountView,
    referralInput,
    setReferralInput,
    selectedMatch,
    setSelectedMatch,
    showUsernameModal,
    setShowUsernameModal,
    newUsername,
    setNewUsername,
    adLoading,
    newDisplayName,
    setNewDisplayName,
    modalMessage,
    setModalMessage,
    topupView,
    setTopupView,
    paymentUpiId,
    setPaymentUpiId,
    showSettleModal,
    setShowSettleModal,
    matchToSettle,
    winnerUsername,
    setWinnerUsername,
    winnerKills,
    setWinnerKills,
    adminEmail,
    toggleMusic,
    claimDaily,
    watchAd,
    handleTopup,
    handleConfirmPayment,
    handleRedeemReward,
    handleJoinMatch,
    approveRequest,
    rejectRequest,
    handleNewMatchChange,
    handleCreateMatch,
    handleSetUsername,
    handleUpdateDisplayName,
    handlePasswordReset,
    handleLogout,
    openSettleModal,
    handleSettleMatch,
    user,
    rewardOptions // Pass rewardOptions as a prop
  } = props;

  return (
    <div className="dash-root">
      <audio ref={audioRef} src="/bgm.mp3" loop />
      <video className="bg-video" autoPlay loop muted playsInline>
        <source src="/bg.mp4" type="video/mp4" />
      </video>
      <div className="dash-overlay" />

      <header className="dash-header">
        <div className="logo-row">
          <img src="/icon.jpg" alt="logo" className="logo" />
          <div>
            <div className="title">Imperial X Esports</div>
            <div className="subtitle">
              {profile.username || profile.displayName || profile.email}
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn small ghost music-btn" onClick={toggleMusic}>
            {isPlaying ? <FaVolumeUp /> : <FaVolumeMute />}
          </button>
          {profile.email === adminEmail && (
            <button className="btn small" onClick={() => setActiveTab("admin")}>
              Admin Panel
            </button>
          )}
        </div>
      </header>

      <main className="dash-main">
        {activeTab === "home" && (
          <>
            <section className="panel">
              <div className="panel-row">
                <div>
                  <div className="muted">Coins</div>
                  <div className="big coin-row">
                    <img
                      src="/coin.jpg"
                      alt="coin"
                      className="coin-icon"
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        animation: "spinCoin 3s linear infinite",
                      }}
                    />
                    <span>{profile.coins ?? 0}</span>
                  </div>
                </div>
                <div className="home-actions">
                  <button className="btn" onClick={claimDaily}>
                    Claim Daily (+10)
                  </button>
                  <button
                    className="btn ghost"
                    onClick={watchAd}
                    disabled={adLoading}
                  >
                    {adLoading ? "Loading Ad..." : "Watch Ad (+5)"}
                  </button>
                </div>
              </div>
            </section>
            <section className="panel">
              {" "}
              <h3>Welcome!</h3> <p>Check the matches tab to join a game.</p>{" "}
            </section>
          </>
        )}

        {activeTab === "matches" && (
          <>
            {!selectedMatch ? (
              // 1. MATCH LIST VIEW (Default)
              <section className="panel">
                <h3>Available Matches</h3>
                {loadingMatches && <p>Loading matches...</p>}
                {!loadingMatches && matches.length === 0 && (
                  <p>No upcoming matches right now. Check back soon!</p>
                )}
                <div className="grid">
                  {matches.map((match) => {
                    const hasJoined = match.playersJoined?.includes(user.uid);
                    const isFull =
                      match.playersJoined?.length >= match.maxPlayers;
                    return (
                      <div
                        key={match.id}
                        className="match-card"
                        onClick={() => setSelectedMatch(match)}
                      >
                        <img src={match.imageUrl} alt={match.title} />
                        <div className="match-info">
                          <div className="match-title">{match.title}</div>
                          <div className="match-meta time">
                            Starts: {formatMatchTime(match.startTime)}
                          </div>
                          <div className="match-meta">
                            Entry: {match.entryFee} Coins | Joined:{" "}
                            {match.playersJoined?.length || 0} /{" "}
                            {match.maxPlayers}
                          </div>
                          <button
                            className="btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleJoinMatch(match);
                            }}
                            disabled={hasJoined || isFull}
                          >
                            {hasJoined ? "Joined" : isFull ? "Full" : "Join"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : (
              // 2. MATCH DETAILS VIEW
              <section className="panel match-details-view">
                <div className="match-details-header">
                  <button
                    className="back-btn"
                    onClick={() => setSelectedMatch(null)}
                  >
                    <FaArrowLeft /> Back to Matches
                  </button>
                  <button
                    className="btn small"
                    onClick={() => setShowUsernameModal(true)}
                  >
                    <FaUserEdit style={{ marginRight: "8px" }} />
                    Edit Username
                  </button>
                </div>

                <img
                  src={selectedMatch.imageUrl}
                  alt="match"
                  className="match-details-image"
                />
                <h3 className="modern-title">{selectedMatch.title}</h3>
                <p className="match-details-time">
                  Starts: {formatMatchTime(selectedMatch.startTime)}
                </p>
                {(() => {
                  const hasJoined =
                    selectedMatch.playersJoined?.includes(user.uid);
                  return (
                    <>
                      {hasJoined && selectedMatch.roomID ? (
                        <div className="room-details">
                          <h4>Room Details</h4>
                          <p>
                            <span>Room ID:</span> {selectedMatch.roomID}
                          </p>
                          <p>
                            <span>Password:</span> {selectedMatch.roomPassword}
                          </p>
                        </div>
                      ) : hasJoined ? (
                        <div className="room-details pending">
                          <p>
                            You have joined! Room ID and Password will be
                            revealed here 15 minutes before the match starts.
                          </p>
                        </div>
                      ) : null}
                      <div className="match-rules">
                        <h4>Match Rules</h4>
                        <p>
                          {selectedMatch.rules ||
                            "No specific rules provided for this match."}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </section>
            )}
          </>
        )}

        {activeTab === "topup" && (
          <>
            {/* 1. Select Amount View */}
            {topupView === "select" && (
              <section className="modern-card">
                <h3 className="modern-title">Top-up Coins</h3>
                <p className="modern-subtitle">
                  1 ₹ = 10 Coins | Choose an amount
                </p>
                <div className="amount-options">
                  {[20, 50, 100, 200].map((amt) => (
                    <div
                      key={amt}
                      className={`amount-btn ${
                        selectedAmount === amt ? "selected" : ""
                      }`}
                      onClick={() => setSelectedAmount(amt)}
                    >
                      ₹{amt} = {amt * 10} Coins
                    </div>
                  ))}
                </div>
                <input
                  type="number"
                  className="modern-input"
                  placeholder="Or enter custom amount ₹"
                  value={topupAmount}
                  onChange={(e) => {
                    setSelectedAmount(null);
                    setTopupAmount(e.target.value);
                  }}
                />
                <button className="btn glow large" onClick={handleTopup}>
                  Pay
                </button>
              </section>
            )}

            {/* 2. Payment View */}
            {topupView === "pay" && (
              <section className="modern-card payment-page">
                <button
                  className="back-btn"
                  onClick={() => setTopupView("select")}
                >
                  <FaArrowLeft /> Back
                </button>
                <h3 className="modern-title">Scan & Pay</h3>
                <p className="modern-subtitle">
                  Scan the QR code to pay ₹{selectedAmount || topupAmount}
                </p>

                <img src="/qr.jpg" alt="QR Code" className="qr-code-image" />

                <div className="form-group" style={{ marginTop: "24px" }}>
                  <label>Enter Your UPI ID</label>
                  <input
                    type="text"
                    className="modern-input"
                    placeholder="Enter your UPI ID (e.g., name@ybl)"
                    value={paymentUpiId}
                    onChange={(e) => setPaymentUpiId(e.target.value)}
                  />
                  <button
                    className="btn glow large"
                    onClick={handleConfirmPayment}
                    disabled={loading}
                  >
                    {loading ? "Submitting..." : "I Have Paid"}
                  </button>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === "withdraw" && (
          <div className="withdraw-container">
            {/* 1. UPI Section */}
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: "10px" }}>
                Redeem Coins as UPI
              </h3>
              <p className="modern-subtitle" style={{ paddingLeft: "10px" }}>
                10% commission fee
              </p>
              <div className="reward-grid">
                {rewardOptions
                  .filter((opt) => opt.type === "UPI")
                  .map((reward) => (
                    <div
                      key={`${reward.type}-${reward.amount}`}
                      className="reward-card"
                      onClick={() => handleRedeemReward(reward)}
                    >
                      <img
                        src={reward.icon}
                        alt="UPI"
                        className="reward-icon"
                      />
                      <div className="reward-cost">
                        <img src="/coin.jpg" alt="coin" />
                        <span>{reward.cost}</span>
                      </div>
                      <div className="reward-amount">₹ {reward.amount}</div>
                    </div>
                  ))}
              </div>
            </section>
            {/* 2. Google Play Section */}
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: "10px" }}>
                Redeem as Google Gift Card
              </h3>
              <div className="reward-grid">
                {rewardOptions
                  .filter((opt) => opt.type === "Google Play")
                  .map((reward) => (
                    <div
                      key={`${reward.type}-${reward.amount}`}
                      className="reward-card"
                      onClick={() => handleRedeemReward(reward)}
                    >
                      <img
                        src={reward.icon}
                        alt="Google Play"
                        className="reward-icon"
                      />
                      <div className="reward-cost">
                        <img src="/coin.jpg" alt="coin" />
                        <span>{reward.cost}</span>
                      </div>
                      <div className="reward-amount">₹ {reward.amount}</div>
                    </div>
                  ))}
              </div>
            </section>
            {/* 3. Amazon Section */}
            <section className="panel">
              <h3 className="modern-title" style={{ paddingLeft: "10px" }}>
                Redeem as Amazon Gift Card
              </h3>
              <div className="reward-grid">
                {rewardOptions
                  .filter((opt) => opt.type === "Amazon")
                  .map((reward) => (
                    <div
                      key={`${reward.type}-${reward.amount}`}
                      className="reward-card"
                      onClick={() => handleRedeemReward(reward)}
                    >
                      <img
                        src={reward.icon}
                        alt="Amazon"
                        className="reward-icon"
                      />
                      <div className="reward-cost">
                        <img src="/coin.jpg" alt="coin" />
                        <span>{reward.cost}</span>
                      </div>
                      <div className="reward-amount">₹ {reward.amount}</div>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        )}

        {activeTab === "admin" && profile.email === adminEmail && (
          <section className="panel">
            <h3>Admin Panel</h3>
            <form onSubmit={handleCreateMatch} className="admin-form">
              <h4>Create New Match</h4>
              <input
                name="title"
                className="modern-input"
                placeholder="Match Title (e.g., 1v1 Clash Squad)"
                value={newMatch.title}
                onChange={handleNewMatchChange}
              />
              <input
                name="imageUrl"
                className="modern-input"
                placeholder="Image URL (e.g., /cs.jpg)"
                value={newMatch.imageUrl}
                onChange={handleNewMatchChange}
              />
              <label>Start Time</label>
              <input
                name="startTime"
                type="datetime-local"
                className="modern-input"
                value={newMatch.startTime}
                onChange={handleNewMatchChange}
              />
              <label>Match Type</label>
              <select
                name="type"
                className="modern-input"
                value={newMatch.type}
                onChange={handleNewMatchChange}
              >
                {" "}
                <option value="BR">Battle Royale</option>{" "}
                <option value="CS">Clash Squad</option>{" "}
              </select>
              <label>Prize Model</label>
              <select
                name="prizeModel"
                className="modern-input"
                value={newMatch.prizeModel}
                onChange={handleNewMatchChange}
              >
                {" "}
                <option value="Scalable">
                  Scalable (BR - % commission)
                </option>{" "}
                <option value="Fixed">Fixed (CS - fixed prize)</option>{" "}
              </select>
              <label>Entry Fee (Coins)</label>
              <input
                name="entryFee"
                type="number"
                className="modern-input"
                value={newMatch.entryFee}
                onChange={handleNewMatchChange}
              />
              <label>Max Players</label>
              <input
                name="maxPlayers"
                type="number"
                className="modern-input"
                value={newMatch.maxPlayers}
                onChange={handleNewMatchChange}
              />
              {newMatch.prizeModel === "Scalable" ? (
                <>
                  {" "}
                  <label>Per Kill Reward (Coins)</label>{" "}
                  <input
                    name="perKillReward"
                    type="number"
                    className="modern-input"
                    value={newMatch.perKillReward}
                    onChange={handleNewMatchChange}
                  />{" "}
                  <label>Commission (%)</label>{" "}
                  <input
                    name="commissionPercent"
                    type="number"
                    className="modern-input"
                    value={newMatch.commissionPercent}
                    onChange={handleNewMatchChange}
                  />{" "}
                </>
              ) : (
                <>
                  {" "}
                  <label>Booyah Prize (Fixed Total)</label>{" "}
                  <input
                    name="booyahPrize"
                    type="number"
                    className="modern-input"
                    value={newMatch.booyahPrize}
                    onChange={handleNewMatchChange}
                  />{" "}
                </>
              )}
              <label>Rules</label>
              <textarea
                name="rules"
                className="modern-input"
                placeholder="Enter match rules..."
                value={newMatch.rules}
                onChange={handleNewMatchChange}
              />
              <button type="submit" className="btn glow">
                {" "}
                Create Match{" "}
              </button>
            </form>
            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />
            
            {/* Settle Matches */}
            <h4>Settle Upcoming Matches</h4>
            <div className="admin-match-list">
              {matches.filter(m => m.status === 'upcoming').length > 0 ? (
                matches.filter(m => m.status === 'upcoming').map(match => (
                  <div key={match.id} className="admin-row">
                    <span>{match.title}</span>
                    <button className="btn small" onClick={() => openSettleModal(match)}>
                      Settle
                    </button>
                  </div>
                ))
              ) : (
                <p className="muted-small" style={{textAlign: 'center'}}>No matches to settle.</p>
              )}
            </div>
            
            <hr style={{ margin: "24px 0", borderColor: "var(--panel)" }} />
            
            <h4>Top-up Requests</h4>
            {requests.topup.map((r) => (
              <div key={r.id} className="admin-row">
                {" "}
                <span>
                  {" "}
                  {r.email} | ₹{r.amount} | UPI: {r.upiId}
                </span>{" "}
                <div>
                  {" "}
                  <button
                    className="btn small"
                    onClick={() => approveRequest("topup", r)}
                  >
                    {" "}
                    Approve{" "}
                  </button>{" "}
                  <button
                    className="btn small ghost"
                    onClick={() => rejectRequest("topup", r)}
                  >
                    {" "}
                    Reject{" "}
                  </button>{" "}
                </div>{" "}
              </div>
            ))}
            <h4>Withdraw Requests</h4>
            {requests.withdraw.map((r) => (
              <div key={r.id} className="admin-row">
                {" "}
                <span>
                  {" "}
                  {r.email} | ₹{r.amount} |{" "}
                  {r.type === "UPI" ? `UPI: ${r.upiId}` : `Type: ${r.type}`}{" "}
                </span>{" "}
                <div>
                  {" "}
                  <button
                    className="btn small"
                    onClick={() => approveRequest("withdraw", r)}
                  >
                    {" "}
                    Approve{" "}
                  </button>{" "}
                  <button
                    className="btn small ghost"
                    onClick={() => rejectRequest("withdraw", r)}
                  >
                    {" "}
                    Reject{" "}
                  </button>{" "}
                </div>{" "}
              </div>
            ))}
          </section>
        )}

        {activeTab === "account" && (
          <div className="account-container">
            {accountView === "main" && (
              <>
                <section className="panel account-profile-card">
                  <h3 className="modern-title">
                    {profile.username || "Set Your Username"}
                  </h3>
                  <p className="modern-subtitle">{profile.email}</p>
                </section>

                <section className="panel account-menu">
                  <button
                    className="account-option"
                    onClick={() => {
                      setNewDisplayName(profile.displayName || ""); // Pre-fill form
                      setAccountView("profile");
                    }}
                  >
                    <FaUserCog size={20} />
                    <span>Profile Settings</span>
                    <span className="arrow">&gt;</span>
                  </button>
                  <button
                    className="account-option"
                    onClick={() => setShowUsernameModal(true)}
                  >
                    {" "}
                    <FaUserEdit size={20} /> <span>Edit In-Game Username</span>{" "}
                    <span className="arrow">&gt;</span>{" "}
                  </button>
                  <button
                    className="account-option"
                    onClick={() => setAccountView("refer")}
                  >
                    {" "}
                    <FaGift size={20} /> <span>Refer a Friend</span>{" "}
                    <span className="arrow">&gt;</span>{" "}
                  </button>
                  <button
                    className="account-option"
                    onClick={() => setAccountView("match_history")}
                  >
                    {" "}
                    <FaHistory size={20} /> <span>Match History</span>{" "}
                    <span className="arrow">&gt;</span>{" "}
                  </button>
                  <button
                    className="account-option"
                    onClick={() => setAccountView("withdraw_history")}
                  >
                    {" "}
                    <FaMoneyBillWave size={20} />{" "}
                    <span>Withdrawal History</span>{" "}
                    <span className="arrow">&gt;</span>{" "}
                  </button>
                  <button
                    className="account-option logout"
                    onClick={handleLogout}
                  >
                    {" "}
                    <FaSignOutAlt size={20} /> <span>Logout</span>{" "}
                    <span className="arrow">&gt;</span>{" "}
                  </button>
                </section>
              </>
            )}

            {accountView === "profile" && (
              <section className="panel">
                <button
                  className="back-btn"
                  onClick={() => setAccountView("main")}
                >
                  <FaArrowLeft /> Back
                </button>
                <h3 className="modern-title">Profile Settings</h3>
                <div className="profile-settings-form">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={user.email}
                      disabled
                    />
                  </div>
                  <div className="form-group">
                    <label>User ID</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={user.uid}
                      disabled
                    />
                  </div>
                  <hr />
                  <form
                    className="form-group"
                    onSubmit={handleUpdateDisplayName}
                  >
                    <label>Display Name</label>
                    <input
                      type="text"
                      className="modern-input"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Enter your display name"
                    />
                    <button type="submit" className="btn" disabled={loading}>
                      {loading ? "Saving..." : "Save Name"}
                    </button>
                  </form>
                  <hr />
                  <div className="form-group">
                    <label>Password</label>
                    <button className="btn ghost" onClick={handlePasswordReset}>
                      Send Password Reset Email
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* (Removed HowToPlay view) */}

            {accountView === "refer" && (
              <section className="panel">
                <button
                  className="back-btn"
                  onClick={() => setAccountView("main")}
                >
                  {" "}
                  <FaArrowLeft /> Back{" "}
                </button>
                <h3 className="modern-title">Refer a Friend</h3>
                <div className="referral-card">
                  <p>Your Unique Referral Code:</p>
                  <div className="referral-code">
                    {profile.referralCode ? profile.referralCode : "Loading..."}
                  </div>
                  <p
                    className="modern-subtitle"
                    style={{ textAlign: "center" }}
                  >
                    Share this code with your friends. When they use it, they get
                    50 coins and you get 20 coins!
                  </p>
                </div>
                {!profile.hasRedeemedReferral && (
                  <div className="referral-form">
                    <p>Have a friend's code?</p>
                    <input
                      type="text"
                      className="modern-input"
                      placeholder="Enter referral code"
                      value={referralInput}
                      onChange={(e) => setReferralInput(e.target.value)}
                    />
                    <button
                      className="btn glow large"
                      onClick={handleRedeemReferral}
                    >
                      {" "}
                      Redeem Code{" "}
                    </button>
                  </div>
                )}
              </section>
            )}
            {accountView === "match_history" && (
              <section className="panel">
                <button
                  className="back-btn"
                  onClick={() => setAccountView("main")}
                >
                  {" "}
                  <FaArrowLeft /> Back{" "}
                </button>
                <MatchHistoryPage user={user} />
              </section>
            )}
            {accountView === "withdraw_history" && (
              <section className="panel">
                <button
                  className="back-btn"
                  onClick={() => setAccountView("main")}
                >
                  {" "}
                  <FaArrowLeft /> Back{" "}
                </button>
                <WithdrawalHistoryPage user={user} />
              </section>
            )}
          </div>
        )}
      </main>

      <footer className="bottom-nav">
        {["home", "matches", "topup", "withdraw", "account"].map((tab) => (
          <button
            key={tab}
            className={`nav-btn ${activeTab === tab ? "active" : ""}`}
            onClick={() => {
              setActiveTab(tab);
              setAccountView("main");
              setSelectedMatch(null);
              setTopupView("select");
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </footer>

      {showUsernameModal && (
        <div className="modal-overlay">
          <div
            className="modal-content modern-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modern-title">
              {profile.username
                ? "Edit Your Username"
                : "Set Your In-Game Username"}
            </h3>
            <p className="modern-subtitle">
              You must set a username before joining a match. This name will be
              used in tournaments.
            </p>
            <form onSubmit={handleSetUsername}>
              <input
                type="text"
                className="modern-input"
                placeholder="Enter your username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
              />
              <button
                type="submit"
                className="btn glow large"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn large ghost"
                style={{ marginTop: "10px" }}
                onClick={() => setShowUsernameModal(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Custom Message Modal */}
      {modalMessage && (
        <div className="modal-overlay" onClick={() => setModalMessage(null)}>
          <div
            className="modal-content modern-card"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="modern-title">Notification</h3>
            <p
              className="modern-subtitle"
              style={{ textAlign: "center", marginBottom: "24px" }}
            >
              {modalMessage}
            </p>
            <button
              className="btn glow large"
              onClick={() => setModalMessage(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Settle Match Modal */}
      {showSettleModal && matchToSettle && (
        <div className="modal-overlay">
          <div className="modal-content modern-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="modern-title">Settle Match</h3>
            <p className="modern-subtitle">
              Settle: {matchToSettle.title}
            </p>
            <form onSubmit={handleSettleMatch}>
              <div className="form-group">
                <label>Winner's Username</label>
                <input
                  type="text"
                  className="modern-input"
                  placeholder="Enter winner's in-game username"
                  value={winnerUsername}
                  onChange={(e) => setWinnerUsername(e.target.value)}
                />
              </div>
              {matchToSettle.prizeModel === 'Scalable' && (
                <div className="form-group">
                  <label>Winner's Kills</label>
                  <input
                    type="number"
                    className="modern-input"
                    placeholder="Enter kill count"
                    value={winnerKills}
                    onChange={(e) => setWinnerKills(parseInt(e.target.value) || 0)}
                  />
                </div>
              )}
              <button type="submit" className="btn glow large" disabled={loading}>
                {loading ? "Submitting..." : "Award Prize & End Match"}
              </button>
              <button
                type="button"
                className="btn large ghost"
                style={{marginTop: '10px'}}
                onClick={() => setShowSettleModal(false)}
              >
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
