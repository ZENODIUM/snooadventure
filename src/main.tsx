import './createPost.js';
import { Devvit, useState, useWebView } from '@devvit/public-api';

Devvit.configure({
  redditAPI: true,
  redis: true,
});

Devvit.addCustomPostType({
  name: 'Snoo Doodle Quest',
  height: 'tall',
  render: (context) => {
    // Load the level name from Redis
    const [levelName, setLevelName] = useState(async () => {
      return await context.redis.get(`level_name_${context.postId}`) || '';
    });
    
    // Get username using useState with an async function
    const [username] = useState(async () => {
      return (await context.reddit.getCurrentUsername()) ?? 'anon';
    });

    // Get Snoovatar URL properly using useState
    const [snoovatarUrl] = useState(async () => {
      const currentUser = await context.reddit.getCurrentUser();
      return currentUser ? await currentUser.getSnoovatarUrl() : undefined;
    });

    // Check if there's a saved drawing in Redis
    const [drawingSaved, setDrawingSaved] = useState(async () => {
      const savedDrawing = await context.redis.get(`drawing_${context.postId}`);
      return savedDrawing !== null && savedDrawing !== undefined;
    });

    // Load the saved drawing from Redis
    const [savedDrawing, setSavedDrawing] = useState(async () => {
      return await context.redis.get(`drawing_${context.postId}`) || null;
    });

    // Load leaderboard data for the specific level
    const [leaderboard, setLeaderboard] = useState(async () => {
      const currentLevelName = await context.redis.get(`level_name_${context.postId}`) || '';
      return await fetchLeaderboard(context, context.postId, currentLevelName);
    });

    // Helper function to fetch leaderboard data
    async function fetchLeaderboard(context, postId, levelName) {
      const leaderboardKey = `leaderboard_${postId}_${levelName}`;
      const leaderboardData = await context.redis.zRange(
        leaderboardKey, 
        0, 
        4, 
        { by: 'score' } // Lower score (time) is better
      );
      return leaderboardData.length > 0 ? leaderboardData : [];
    }

    const webView = useWebView({
      url: 'page.html',
      async onMessage(message, webView) {
        switch (message.type) {
          case 'webViewReady':
            webView.postMessage({
              type: 'initialData',
              data: {
                snoovatarUrl: snoovatarUrl,
                username: username,
                mode: drawingSaved ? 'view' : 'create',
                savedDrawing: savedDrawing,
                leaderboard: leaderboard
              },
            });
            break;
          case 'saveDrawing':
            await context.redis.set(`drawing_${context.postId}`, message.data.drawing);
            setSavedDrawing(message.data.drawing);
            setDrawingSaved(true);
            
            // Update level name and refresh leaderboard
            const newLevelName = message.data.levelName;
            await context.redis.set(`level_name_${context.postId}`, newLevelName);
            setLevelName(newLevelName);
            
            // Refresh leaderboard with new level name
            const updatedLeaderboard = await fetchLeaderboard(context, context.postId, newLevelName);
            setLeaderboard(updatedLeaderboard);
            break;
          case 'submitTime':
            const drawingTime = message.data.time; // Time in seconds
            const currentLevelName = message.data.levelName || await context.redis.get(`level_name_${context.postId}`) || '';
            
            // Create a level-specific leaderboard key
            const leaderboardKey = `leaderboard_${context.postId}_${currentLevelName}`;
            
            // Check if user already has a time in this level's leaderboard
            const userCurrentScore = await context.redis.zScore(leaderboardKey, username);
            
            // Only add/update if:
            // 1. User doesn't have a previous score, OR
            // 2. New time is better (lower) than their previous time
            let shouldAdd = false;
            
            if (userCurrentScore === undefined) {
              // User doesn't have a score yet
              shouldAdd = true;
            } else if (drawingTime < userCurrentScore) {
              // New time is better than previous time
              shouldAdd = true;
            }
          
            if (shouldAdd) {
              // Add/update the user's time only if it's better
              await context.redis.zAdd(
                leaderboardKey, 
                { member: username, score: drawingTime }
              );
              
              // Get updated leaderboard (top 5)
              const updatedLeaderboard = await fetchLeaderboard(context, context.postId, currentLevelName);
              setLeaderboard(updatedLeaderboard);
            }
            break;
          default:
            throw new Error(`Unknown message type: ${message}`);
        }
      },
      onUnmount() {
        context.ui.showToast('Quest closed!');
      },
    });

    // Format time function
    const formatTime = (timeSeconds) => {
      // Convert to number in case it comes as string
      const seconds = Number(timeSeconds);
      
      // Format with 2 decimal places for precision
      return `${seconds.toFixed(2)}s`;
    };

    return (
      <zstack width="100%" height="100%" alignment="center top">
        {/* Background Image */}
        <image 
          url="game_background.png" 
          imageWidth={1024} 
          imageHeight={768} 
          width="100%" 
          height="100%" 
          resizeMode="cover"
          description="Game background" 
        />
        
        {/* Content */}
        <vstack width="100%" height="100%" padding="small" alignment="center top">
          <vstack grow alignment="center top"> 
            <image 
              url="main_bg.png" 
              imageWidth={300} 
              imageHeight={300} 
              resizeMode="fit"
              description="Snoo Logo" 
            />
            
            {levelName && (
              <hstack alignment="center middle">
                <text size="medium">Quest Name:</text>
                <text size="medium" weight="bold" color="#FF4500">{levelName}</text>
              </hstack>
            )} 
            
            {/* Leaderboard Section */}
            <vstack width="80%" padding="medium" cornerRadius="medium" backgroundColor="neutral-background" alignment="center middle">
              <text size="large" weight="bold" alignment="center">Hall of Snoo</text>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry, index) => (
                  <hstack key={index} width="100%" alignment="center middle">
                    <text>{index + 1}. {entry.member}</text>
                    <spacer grow />
                    <text>{formatTime(entry.score)}</text>
                  </hstack>
                ))
              ) : (
                <text alignment="center">No times recorded yet</text>
              )}
            </vstack>
            
            <spacer />
            {!drawingSaved ? (
              <button icon="topic-art" appearance="primary" onPress={() => webView.mount()}>Create Quest</button>
            ) : (
              <button icon="topic-videogaming" appearance="primary" onPress={() => webView.mount()}>Enter Quest</button>
            )}
          </vstack>
        </vstack>
      </zstack>
    );
  },
});

export default Devvit;