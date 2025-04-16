import React from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActionArea from '@mui/material/CardActionArea';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import { styled } from '@mui/material/styles';

import { useTheme } from '../context/ThemeContext';
import FollowButton from './FollowButton';

// Styled components
const UserAvatar = styled(Avatar)(({ theme }) => ({
  width: 60,
  height: 60,
  marginRight: theme.spacing(2),
  backgroundColor: theme.palette.primary.main,
}));

const UserCardStyled = styled(Card)(({ theme, isdarkmode, isblurred }) => ({
  marginBottom: theme.spacing(2),
  transition: 'all 0.3s ease',
  position: 'relative',
  overflow: 'visible',
  filter: isblurred === 'true' ? 'blur(5px)' : 'none',
  backgroundColor: isdarkmode === 'true' ? '#333' : '#fff',
  color: isdarkmode === 'true' ? '#fff' : '#333',
  '&:hover': {
    transform: isblurred === 'true' ? 'none' : 'translateY(-5px)',
    boxShadow: isblurred === 'true' ? 'none' : '0 10px 20px rgba(0,0,0,0.15)',
  },
}));

const RoleChip = styled(Chip)(({ theme, role }) => {
  const roleColors = {
    artist: {
      bg: theme.palette.primary.main,
      color: '#fff',
    },
    collector: {
      bg: theme.palette.secondary.main,
      color: '#fff',
    },
    admin: {
      bg: '#d32f2f',
      color: '#fff',
    },
  };
  
  const roleColor = roleColors[role] || { bg: '#757575', color: '#fff' };
  
  return {
    backgroundColor: roleColor.bg,
    color: roleColor.color,
    fontWeight: 'bold',
    fontSize: '0.7rem',
  };
});

const BlurOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  background: 'rgba(0,0,0,0.6)',
  color: '#fff',
  zIndex: 2,
  borderRadius: theme.shape.borderRadius,
}));

function UserCard({ user, currentUser, isBlurred = false }) {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';

  // Format the initials for the avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase();
  };

  const handleCardClick = () => {
    if (!isBlurred) {
      navigate(`/users/${user.username}`);
    }
  };

  // Determine if this is the current user
  const isCurrentUser = currentUser && currentUser.user_id === user.user_id;

  return (
    <UserCardStyled 
      isdarkmode={isDarkMode.toString()} 
      isblurred={isBlurred.toString()}
    >
      {isBlurred && (
        <BlurOverlay>
          <Typography variant="body1">Follow to view profile</Typography>
        </BlurOverlay>
      )}
      <CardActionArea 
        onClick={handleCardClick}
        disabled={isBlurred}
        sx={{ pointerEvents: isBlurred ? 'none' : 'auto' }}
      >
        <CardContent>
          <Box display="flex" alignItems="center">
            <UserAvatar>
              {getInitials(user.username || user.email)}
            </UserAvatar>
            <Box flexGrow={1}>
              <Typography variant="h6" component="h2">
                {user.username || user.email}
              </Typography>
              <Box display="flex" alignItems="center" mt={0.5}>
                <RoleChip 
                  label={user.role || 'collector'} 
                  size="small" 
                  role={user.role || 'collector'}
                />
                {user.favorite_color && (
                  <Box 
                    ml={1} 
                    width={16} 
                    height={16} 
                    borderRadius="50%" 
                    style={{ backgroundColor: user.favorite_color }} 
                  />
                )}
              </Box>
            </Box>
            {!isCurrentUser && !isBlurred && (
              <FollowButton 
                userId={user.user_id} 
                username={user.username}
                isFollowing={user.is_following}
                size="small"
              />
            )}
          </Box>
        </CardContent>
      </CardActionArea>
    </UserCardStyled>
  );
}

export default UserCard;