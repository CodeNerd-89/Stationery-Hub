import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { referralsAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { 
  HiOutlineUser, 
  HiOutlineMail, 
  HiOutlinePhone, 
  HiOutlineLink,
  HiOutlineUsers,
  HiOutlineClipboardCopy
} from 'react-icons/hi';
import './Profile.css';

const Profile = () => {
  const { user } = useAuth();
  const [referralData, setReferralData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReferralData = async () => {
      try {
        const { data } = await referralsAPI.getMyCode();
        setReferralData(data);
      } catch (err) {
        console.error('Failed to load referral data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchReferralData();
  }, []);

  const copyToClipboard = () => {
    if (referralData?.referralLink) {
      navigator.clipboard.writeText(referralData.referralLink);
      toast.success('Referral link copied!');
    }
  };

  if (!user) return null;

  return (
    <div className="profile-page">
      <div className="page-header">
        <h1>My Account</h1>
        <p className="subtitle">Manage your profile and settings</p>
      </div>

      <div className="profile-grid">
        {/* Personal Info */}
        <div className="profile-card info-card">
          <div className="card-header">
            <h2>Personal Information</h2>
          </div>
          <div className="card-body">
            <div className="avatar-wrapper">
              <div className="avatar-circle">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="role-badge">{user.role}</div>
            </div>

            <div className="info-list">
              <div className="info-item">
                <div className="info-icon"><HiOutlineUser /></div>
                <div className="info-content">
                  <label>Full Name</label>
                  <p>{user.name}</p>
                </div>
              </div>

              <div className="info-item">
                <div className="info-icon"><HiOutlineMail /></div>
                <div className="info-content">
                  <label>Email Address</label>
                  <p>{user.email}</p>
                </div>
              </div>

              {user.phone && (
                <div className="info-item">
                  <div className="info-icon"><HiOutlinePhone /></div>
                  <div className="info-content">
                    <label>Phone Number</label>
                    <p>{user.phone}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Referrals */}
        <div className="profile-card referral-card">
          <div className="card-header">
            <h2>Refer & Earn</h2>
          </div>
          <div className="card-body">
            <div className="referral-banner">
              <div className="banner-icon"><HiOutlineUsers /></div>
              <h3>Invite Friends!</h3>
              <p>Share your code and you both get rewards when they sign up and place their first order.</p>
            </div>

            {loading ? (
              <div className="spinner-small"></div>
            ) : referralData ? (
              <div className="referral-stats-container">
                <div className="referral-code-box">
                  <label>Your Referral Code</label>
                  <div className="code-display">
                    <code>{referralData.referralCode || 'Not generated yet'}</code>
                  </div>
                </div>

                <div className="referral-link-box">
                  <label>Your Invite Link</label>
                  <div className="link-input-group">
                    <div className="link-icon"><HiOutlineLink /></div>
                    <input type="text" value={referralData.referralLink || ''} readOnly />
                    <button className="copy-btn" onClick={copyToClipboard} title="Copy Link">
                      <HiOutlineClipboardCopy />
                    </button>
                  </div>
                </div>

                <div className="referral-stats">
                  <div className="stat-box">
                    <span className="stat-value">{referralData.referralCount}</span>
                    <span className="stat-label">Friends Invited</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted">Referral system is currently unavailable.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
