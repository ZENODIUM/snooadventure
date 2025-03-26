class App {
  constructor() {
    this.canvas = document.querySelector('#drawingCanvas');
    this.ctx = this.canvas.getContext('2d');
    // Add to your App constructor
    this.gameOver = false;
    this.maxSpeed = 5; // Maximum speed of the avatar
    this.horizontalOffset = 0.2;
    this.facingLeft = false; 
    this.fallbackSnoovatarUrl = 'default_snoo.png';

    this.timerElement = document.querySelector('#timer');
    this.startTime = 0;
    this.currentTime = 0;
    this.finalTime = 0;
    this.timerInterval = null;
    this.isTimerRunning = false;



    this.errorMessage = document.querySelector('#error-message'); // Add this line

    // Create a separate canvas for collision detection
    this.collisionCanvas = document.createElement('canvas');
    this.collisionCtx = this.collisionCanvas.getContext('2d');
    this.friction = 0.8; // Friction factor (0 < friction < 1)
    this.saveButton = document.querySelector('#btn-save');
    this.clearButton = document.querySelector('#btn-clear');
    this.colorButtons = document.querySelectorAll('.color-button');
    this.usernameLabel = document.querySelector('#username');
    this.mode = 'create'; // Default mode is 'create'
    this.savedDrawing = null;
    this.isDrawingEnabled = true; // Track whether drawing is enabled
    this.currentColor = 'black'; // Default drawing color
    this.snoovatarImg = null; // Store Snoovatar image

    this.canvas.width = window.innerWidth * 0.8;
    this.canvas.height = window.innerHeight * 0.6;
    
    // Set collision canvas to same dimensions
    this.collisionCanvas.width = this.canvas.width;
    this.collisionCanvas.height = this.canvas.height;

    const initialSnooSize = Math.min(this.canvas.width, this.canvas.height) * 0.2;
    this.snoovatarX = 0;  // Start at left edge
    this.snoovatarY = 0;  // Start at top edge
    this.isJumping = false;
    this.velocityY = 0; // Vertical velocity
    this.velocityX = 0; // Horizontal velocity
    this.gravity = 0.5; // Gravity strength
    this.groundLevel = this.canvas.height * 0.9; // Ground level (where the avatar stops falling)
    this.baseMoveSpeed = 5; // Base movement speed
    this.baseJumpStrength = 8; // Base jump strength
    this.isOnYellow = false; // Track if the avatar is on a yellow line
    this.isOnBlue = false; // Track if the avatar is on a blue line

    let isDrawing = false;

    // Set up drawing functionality
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.isDrawingEnabled) {
        isDrawing = true;
        this.ctx.beginPath();
        this.ctx.moveTo(e.offsetX, e.offsetY);
        
        // Also begin path on collision canvas
        this.collisionCtx.beginPath();
        this.collisionCtx.moveTo(e.offsetX, e.offsetY);
      }
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDrawing && this.isDrawingEnabled) {
        // Draw on visible canvas with selected color
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineTo(e.offsetX, e.offsetY);
        this.ctx.stroke();
        
        // Draw on collision canvas in black (only if the current color is black)
        if (this.currentColor === 'black') {
          this.collisionCtx.strokeStyle = 'black';
          this.collisionCtx.lineTo(e.offsetX, e.offsetY);
          this.collisionCtx.stroke();
        }
      }
    });

    this.canvas.addEventListener('mouseup', () => {
      isDrawing = false;
    });

    // Save button functionality
// Save button functionality
this.saveButton.addEventListener('click', () => {
  if (!this.hasGreenPixel()) {
    this.showError('Add at least one green pixel to save :)');
    return;
  }
  
  const levelNameInput = document.querySelector('#levelName');
  const levelName = levelNameInput.value.trim() || 'Unnamed Level';
  
  const drawingData = this.canvas.toDataURL();
  postWebViewMessage({ 
    type: 'saveDrawing', 
    data: { 
      drawing: drawingData,
      levelName: levelName
    } 
  });
  this.disableEditing();
});

    // Clear button functionality
    this.clearButton.addEventListener('click', () => {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); // Clear the visible canvas
      this.collisionCtx.clearRect(0, 0, this.collisionCanvas.width, this.collisionCanvas.height); // Clear the collision canvas
      this.redrawCanvas(); // Ensure Snoovatar stays on top after clearing
    });

    // Color button functionality
    this.colorButtons.forEach((button) => {
      button.addEventListener('click', () => {
        this.currentColor = button.dataset.color; // Set the selected color
      });
    });

    // Handle messages from Devvit
    addEventListener('message', this.#onMessage);

    // Notify Devvit that the webview is ready
    addEventListener('load', () => {
      postWebViewMessage({ type: 'webViewReady' });
    });

    // Start the game loop
    this.gameLoop();
  }

  hasGreenPixel() {
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const pixels = imageData.data;
    
    for (let i = 0; i < pixels.length; i += 4) {
      // Check for green pixels (R<50, G>200, B<50)
      if (pixels[i] < 50 && pixels[i+1] > 200 && pixels[i+2] < 50) {
        return true;
      }
    }
    return false;
  }


  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
    setTimeout(() => {
      this.errorMessage.style.display = 'none';
    }, 3000);
  }

  // Add these new methods
  // In the startTimer method, change to:
startTimer() {
  if (this.isTimerRunning) return;
  this.isTimerRunning = true;
  this.startTime = Date.now();
  this.timerInterval = setInterval(() => {
    this.currentTime = Math.floor((Date.now() - this.startTime) / 1000);
    this.timerElement.textContent = `Time: ${this.currentTime}s`;
  }, 1000);
}

// In the stopTimer method, change to:
stopTimer() {
  if (this.isTimerRunning) {
    clearInterval(this.timerInterval);
    this.isTimerRunning = false;
    this.finalTime = Math.floor((Date.now() - this.startTime) / 1000);
    this.timerElement.textContent = `Time: ${this.finalTime}s`;
  }
}



  // Modified collision detection method to use the collision canvas
  checkCollision(x, y, width, height) {
    try {
      // Get the image data from the collision canvas
      const adjustedWidth = width * (1 - 2 * this.horizontalOffset);
      const adjustedX = x + (width * this.horizontalOffset);
  
      // Get image data for the adjusted collision area
      const imageData = this.collisionCtx.getImageData(
        adjustedX, 
        y, 
        adjustedWidth, 
        height
      );
      const pixels = imageData.data;
      
      // Check if any pixel is black (wall), red (game over), green (win), yellow (speed boost), or blue (slow down)
      for (let i = 0; i < pixels.length; i += 4) {
        // Check for black pixels (R=0, G=0, B=0, A>0)
        if (pixels[i] === 0 && pixels[i+1] === 0 && pixels[i+2] === 0 && pixels[i+3] > 0) {
          return true; // Collision detected
        }

        // Check for red pixels (R>200, G<50, B<50, A>0)
        if (pixels[i] > 200 && pixels[i+1] < 50 && pixels[i+2] < 50 && pixels[i+3] > 0) {
          this.showGameOver();
          return true; // Collision detected
        }

        // Check for green pixels (R<50, G>200, B<50, A>0)
        if (pixels[i] < 50 && pixels[i+1] > 200 && pixels[i+2] < 50 && pixels[i+3] > 0) {
          this.showYouWin();
          return true; // Collision detected
        }

        // Check for yellow pixels (R>200, G>200, B<50, A>0)
        if (pixels[i] > 200 && pixels[i+1] > 200 && pixels[i+2] < 50 && pixels[i+3] > 0) {
          this.isOnYellow = true; // Avatar is on a yellow line
          this.isOnBlue = false; // Reset blue line status
          return true; // Collision detected
        }

        // Check for blue pixels (R<50, G<50, B>200, A>0)
        if (pixels[i] < 50 && pixels[i+1] < 50 && pixels[i+2] > 200 && pixels[i+3] > 0) {
          this.isOnBlue = true; // Avatar is on a blue line
          this.isOnYellow = false; // Reset yellow line status
          return true; // Collision detected
        }
      }
      
      // Reset yellow and blue line status if no collision
      this.isOnYellow = false;
      this.isOnBlue = false;
      return false; // No collision
    } catch (error) {
      console.error("Collision detection error:", error);
      return false; // Default to no collision on error
    }
  }

  // Add this method to show you win screen
  showYouWin() {
    if (this.gameOver) return; // Prevent multiple calls
    this.stopTimer();
    this.gameOver = true; // Use the same flag to prevent movement
    window.parent.postMessage({
      type: 'submitTime',
      data: { time: this.finalTime }
    }, '*');
    
    // Create you win overlay
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay'; // Reuse the same CSS class
    overlay.innerHTML = `
      <div class="game-over-container" style="font-family: Pangolin;">
        <h2>You Win!</h2>
        <p>Time: ${this.finalTime}s</p>
        <button id="btn-restart" style="font-family: Pangolin;">Play Again</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add restart button functionality
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.restartGame();
    });
  }

  // Add this method to show game over screen
  showGameOver() {
    if (this.gameOver) return; // Prevent multiple calls
     this.stopTimer(); // Add this line
    this.gameOver = true;
    
    // Create game over overlay
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
      <div class="game-over-container" style="font-family: Pangolin;">
        <h2>Game Over</h2>
        <button id="btn-restart" style="font-family: Pangolin;">Restart</button>
      </div>
    `;
    
    document.body.appendChild(overlay);
    
    // Add restart button functionality
    document.getElementById('btn-restart').addEventListener('click', () => {
      this.restartGame();
    });
  }

  // Add this method to restart the game
  restartGame() {
    this.stopTimer();
    this.timerElement.textContent = 'Time: 0s';
    if (this.mode === 'view') {
      this.startTimer();
    }
    // Remove game over overlay
    const overlay = document.querySelector('.game-over-overlay');
    if (overlay) {
      document.body.removeChild(overlay);
    }
    
    // Reset game state
    this.gameOver = false;
// To top-left reset:
this.snoovatarX = 0;  // Reset to left edge
this.snoovatarY = 0;  // Reset to top edge
    this.velocityY = 0;
    this.velocityX = 0;
    this.isJumping = false;
    this.isOnYellow = false;
    this.isOnBlue = false;
    
    // Redraw canvas
    this.redrawCanvas();
  }

  // Disable editing functionality (hide buttons and disable drawing)
  disableEditing() {
    this.isDrawingEnabled = false;
    this.saveButton.style.display = 'none';
    this.clearButton.style.display = 'none';
    document.querySelector('#level-name-input').style.display = 'none';
    this.colorButtons.forEach((button) => {
      button.style.display = 'none';
    });

    // Ensure Snoovatar stays on top
    this.drawSnoovatar();
  }

  #onMessage = (ev) => {
    if (ev.data.type !== 'devvit-message') return;
    const { message } = ev.data.data;

    switch (message.type) {
      case 'initialData': {
        const { username, mode, savedDrawing, snoovatarUrl } = message.data;
        this.usernameLabel.innerText = username;
        this.mode = mode;
        const levelNameInput = document.querySelector('#level-name-input');
        levelNameInput.style.display = mode === 'create' ? 'block' : 'none';

        // Show or hide navigation buttons based on the mode
        const navigationButtons = document.querySelector('.navigation-buttons');
        if (mode === 'view') {
          navigationButtons.style.display = 'block'; // Show buttons in view mode
          this.timerElement.style.display = 'block';
          this.startTimer();
        } else {
          navigationButtons.style.display = 'none'; // Hide buttons in create mode
          this.timerElement.style.display = 'none';
        }

        // Store Snoovatar image
        if (this.mode === 'view') {
          this.snoovatarImg = new Image();
          this.snoovatarImg.src = snoovatarUrl || this.fallbackSnoovatarUrl;
          console.log('snoovatarUrl:', snoovatarUrl);
          this.snoovatarImg.onload = () => {
            this.redrawCanvas(); // Ensure everything is drawn in correct order
          };
          this.snoovatarImg.onerror = (err) => {
            console.error('Failed to load Snoovatar image:', err);
            // Optionally, you can set a placeholder image here
            this.snoovatarImg.src = 'default_snoo.png'; // Add a placeholder image
          };
        }

        if (mode === 'view' && savedDrawing) {
          // Load the saved drawing in 'view' mode
          this.savedDrawingImg = new Image();
          this.savedDrawingImg.src = savedDrawing;
          this.savedDrawingImg.onload = () => {
            // Draw the saved image on both canvases
            this.redrawCanvas();
            
            // Also draw to collision canvas (for black lines only)
            // We need to extract black pixels from the saved drawing
            this.extractBlackPixelsForCollision();
          };
          this.disableEditing(); // Disable editing in 'view' mode
        }

        // Add event listeners for left, right, and jump buttons
        const btnLeft = document.querySelector('#btn-left');
        const btnRight = document.querySelector('#btn-right');
        const btnJump = document.querySelector('#btn-jump');

        if (btnLeft) {
          btnLeft.addEventListener('click', () => this.moveAvatar('left'));
        }
        if (btnRight) {
          btnRight.addEventListener('click', () => this.moveAvatar('right'));
        }
        if (btnJump) {
          btnJump.addEventListener('click', () => this.jumpAvatar());
        }

        break;
      }
      default:
        const _ = message;
        break;
    }
  };

  // Extract black pixels from saved drawing for collision detection
  extractBlackPixelsForCollision() {
    if (!this.savedDrawingImg) return;
    
    // Create a temporary canvas to analyze the saved drawing
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = this.canvas.width;
    tempCanvas.height = this.canvas.height;
    
    // Draw the saved image to the temp canvas
    tempCtx.drawImage(this.savedDrawingImg, 0, 0);
    
    try {
      // Get image data from temp canvas
      const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
      const pixels = imageData.data;
      
      // Create a new ImageData for the collision canvas
      const collisionData = this.collisionCtx.createImageData(tempCanvas.width, tempCanvas.height);
      const collisionPixels = collisionData.data;
      
      // Copy only black, red, green, yellow, and blue pixels to collision data
      for (let i = 0; i < pixels.length; i += 4) {
        // Check if pixel is black (or very dark)
        if (pixels[i] < 30 && pixels[i+1] < 30 && pixels[i+2] < 30 && pixels[i+3] > 0) {
          collisionPixels[i] = 0;      // R
          collisionPixels[i+1] = 0;    // G
          collisionPixels[i+2] = 0;    // B
          collisionPixels[i+3] = 255;  // A (fully opaque)
        }

        // Check if pixel is red
        else if (pixels[i] > 200 && pixels[i+1] < 50 && pixels[i+2] < 50 && pixels[i+3] > 0) {
          collisionPixels[i] = 255;    // R
          collisionPixels[i+1] = 0;    // G
          collisionPixels[i+2] = 0;    // B
          collisionPixels[i+3] = 255;  // A (fully opaque)
        }

        // Check if pixel is green
        else if (pixels[i] < 50 && pixels[i+1] > 200 && pixels[i+2] < 50 && pixels[i+3] > 0) {
          collisionPixels[i] = 0;      // R
          collisionPixels[i+1] = 255;  // G
          collisionPixels[i+2] = 0;    // B
          collisionPixels[i+3] = 255;  // A (fully opaque)
        }

        // Check if pixel is yellow
        else if (pixels[i] > 200 && pixels[i+1] > 200 && pixels[i+2] < 50 && pixels[i+3] > 0) {
          collisionPixels[i] = 255;    // R
          collisionPixels[i+1] = 255;  // G
          collisionPixels[i+2] = 0;    // B
          collisionPixels[i+3] = 255;  // A (fully opaque)
        }

        // Check if pixel is blue
        else if (pixels[i] < 50 && pixels[i+1] < 50 && pixels[i+2] > 200 && pixels[i+3] > 0) {
          collisionPixels[i] = 0;      // R
          collisionPixels[i+1] = 0;    // G
          collisionPixels[i+2] = 255;  // B
          collisionPixels[i+3] = 255;  // A (fully opaque)
        }
      }
      
      // Put the collision data on the collision canvas
      this.collisionCtx.putImageData(collisionData, 0, 0);
    } catch (error) {
      console.error("Error extracting black pixels:", error);
    }
  }

  // Function to handle avatar movement (left or right)
  moveAvatar(direction) {
    if (!this.snoovatarImg) return;
  
    let acceleration = this.baseMoveSpeed;
    if (this.isOnYellow) {
      acceleration *= 1.5; // Increase acceleration on yellow
    } else if (this.isOnBlue) {
      acceleration *= 0.5; // Decrease acceleration on blue
    }
  
    if (direction === 'left') {
      this.facingLeft = true;
      this.velocityX -= acceleration; // Accelerate left
    } else if (direction === 'right') {
      this.facingLeft = false;
      this.velocityX += acceleration; // Accelerate right
    }
  
    // Limit the velocity to the maximum speed
    this.velocityX = Math.max(-this.maxSpeed, Math.min(this.maxSpeed, this.velocityX));
  
    this.redrawCanvas();
  }

  jumpAvatar() {
    if (!this.snoovatarImg || this.isJumping) return;

    let jumpStrength = this.baseJumpStrength;
    if (this.isOnYellow) {
      jumpStrength *= 1.5; // Increase jump strength on yellow
    } else if (this.isOnBlue) {
      jumpStrength *= 0.5; // Decrease jump strength on blue
    }

    this.isJumping = true;
    this.velocityY = -jumpStrength; // Apply jump strength
  }

  // Game loop to handle gravity and movement
  gameLoop() {
    if (this.snoovatarImg) {
      const snooSize = Math.min(this.canvas.width, this.canvas.height) * 0.2;
      const adjustedWidth = snooSize * (1 - 2 * this.horizontalOffset);
      const adjustedX = this.snoovatarX + (snooSize * this.horizontalOffset);
      
      // Apply gravity
      this.velocityY += this.gravity;
      
      // Apply horizontal velocity
      let newX = this.snoovatarX + this.velocityX;
  
      // Check for collision at the new horizontal position
      if (this.checkCollision(newX, this.snoovatarY, snooSize, snooSize)) {
        // Collision detected, apply friction to slow down the avatar
        this.velocityX *= this.friction;
      } else {
        // No collision, update the position
        this.snoovatarX = newX;
      }
  
      // Calculate new vertical position
      const newY = this.snoovatarY + this.velocityY;
      
      // Check for collision at the new vertical position
      if (this.checkCollision(this.snoovatarX, newY, snooSize, snooSize)) {
        // Collision detected, stop vertical movement
        this.velocityY = 0;
        this.isJumping = false;
      } else {
        // No collision, update the position
        this.snoovatarY = newY;
      }
  
      // Check if the avatar hits the ground
      if (this.snoovatarY + snooSize > this.groundLevel) {
        this.snoovatarY = this.groundLevel - snooSize;
        this.velocityY = 0;
        this.isJumping = false;
      }
  
      // Apply friction to horizontal velocity (optional, for smoother stopping)
      this.velocityX *= 0.9; // Adjust the friction value as needed
  
      // Ensure the avatar stays within canvas bounds
      // With this more precise boundary check:
const minX = 0;
const maxX = this.canvas.width - snooSize;
this.snoovatarX = Math.max(minX, Math.min(maxX, this.snoovatarX));
      
      this.redrawCanvas();
    }
  
    requestAnimationFrame(() => this.gameLoop());
  }
  // Redraw canvas elements (ensures Snoovatar is always on top)
  redrawCanvas() {
    // Clear the canvas first
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw the saved drawing first (if it exists)
    if (this.savedDrawingImg) {
      this.ctx.drawImage(this.savedDrawingImg, 0, 0);
    }

    // Then draw the Snoovatar on top
    if (this.snoovatarImg) {
      this.drawSnoovatar();
    }
  }

  // Draw Snoovatar on top of the canvas
  drawSnoovatar() {
    if (this.snoovatarImg) {
      const snooSize = Math.min(this.canvas.width, this.canvas.height) * 0.2;
      

    
  
      this.ctx.save(); // Save the current context state
      
      if (this.facingLeft) {
        // Flip horizontally by scaling and translating
        this.ctx.translate(this.snoovatarX + snooSize, this.snoovatarY);
        this.ctx.scale(-1, 1);
        this.ctx.drawImage(this.snoovatarImg, 0, 0, snooSize, snooSize);
      } else {
        this.ctx.drawImage(this.snoovatarImg, this.snoovatarX, this.snoovatarY, snooSize, snooSize);
      }
      
      this.ctx.restore(); // Restore the original context state
    }
  }
}

function postWebViewMessage(msg) {
  parent.postMessage(msg, '*');
}

new App();
