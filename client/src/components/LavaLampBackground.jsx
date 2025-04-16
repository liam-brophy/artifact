import React, { useRef, useEffect } from 'react';
import p5 from 'p5';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext'; // Import useAuth to access user data

const LavaLampBackground = () => {
  const sketchRef = useRef();
  const { isDarkMode } = useTheme();
  const { user } = useAuth(); // Access the user object

  useEffect(() => {
    const sketch = (p) => {
      let blobs = [];

      p.setup = () => {
        p.createCanvas(p.windowWidth, p.windowHeight);
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        for (let i = 0; i < 20; i++) { // Increase to 20 orbs
          const blob = new Blob(p);
          blob.x = centerX; // Start all orbs at the center
          blob.y = centerY; // Start all orbs at the center
          blob.xSpeed = p.random(-5, 5); // Initial burst speed
          blob.ySpeed = p.random(-5, 5); // Initial burst speed
          blobs.push(blob);
        }
      };

      p.draw = () => {
        p.clear();
        p.noStroke();
        const orbColor = user?.favorite_color || '#F50801'; // Default to red if no favorite color is set
        p.drawingContext.shadowBlur = 50; // Add significant blur
        p.drawingContext.shadowColor = orbColor; // Set the shadow color to the orb color
        p.drawingContext.filter = 'blur(30px)'; // Apply a dramatic Gaussian blur
        p.fill(p.color(orbColor)); // Explicitly convert to p5.js color object
        blobs.forEach((blob) => {
          blob.update(cursorX, cursorY);
          blob.display();
        });
      };

      p.windowResized = () => {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
      };

      class Blob {
        constructor(p) {
          this.p = p;
          this.x = p.random(p.width);
          this.y = p.random(p.height);
          this.r = p.random(20, 150); // Increase range for more dramatic size variation
          this.xSpeed = p.random(-3, 3) * (100 / this.r) * p.random(3, 5); // Increase speed variation range
          this.ySpeed = p.random(-3, 3) * (100 / this.r) * p.random(3, 5); // Increase speed variation range
          this.offset = p.random(1000); // Offset for noise-based distortion
          this.timeOffset = p.random(1000); // Unique time offset for evolving distortion
          const orbColor = user?.favorite_color || 0; // Ensure orbColor is defined
          this.hue = p.random(orbColor - 20, orbColor + 20); // Restrict hue variation to a narrow range around the base color
        }

        update(cursorX, cursorY) {
          const attractionStrength = 0.01; // Strength of the magnetic effect
          const dx = cursorX - this.x;
          const dy = cursorY - this.y;
          this.xSpeed += dx * attractionStrength / this.r; // Adjust speed based on cursor distance
          this.ySpeed += dy * attractionStrength / this.r; // Adjust speed based on cursor distance

          // Limit the speed to prevent orbs from becoming too fast
          const maxSpeed = 2;
          this.xSpeed = p.constrain(this.xSpeed, -maxSpeed, maxSpeed);
          this.ySpeed = p.constrain(this.ySpeed, -maxSpeed, maxSpeed);

          this.x += this.xSpeed;
          this.y += this.ySpeed;

          if (this.x < 0 || this.x > p.width) this.xSpeed *= -1;
          if (this.y < 0 || this.y > p.height) this.ySpeed *= -1;

          this.timeOffset += 0.01; // Increment time offset for evolving distortion
        }

        display() {
          p.colorMode(p.HSB, 360, 100, 100, 100); // Use HSB color mode for hue variation
          p.beginShape();
          for (let angle = 0; angle < p.TWO_PI; angle += 0.1) {
            const xOff = p.cos(angle) * 2 + this.offset + this.timeOffset; // Add evolving distortion
            const yOff = p.sin(angle) * 2 + this.offset + this.timeOffset; // Add evolving distortion
            const radius = this.r + p.noise(xOff, yOff) * 50; // Amplify noise effect
            const x = this.x + p.cos(angle) * radius;
            const y = this.y + p.sin(angle) * radius;
            const rippleHue = (this.hue + p.frameCount * 2) % 360; // Animate hue for ripple effect
            p.fill(rippleHue, 80, 100, 50); // Set fill color with animated hue
            p.vertex(x, y);
          }
          p.endShape(p.CLOSE);
        }
      }

      let cursorX = p.width / 2;
      let cursorY = p.height / 2;

      p.mouseMoved = () => {
        cursorX = p.mouseX;
        cursorY = p.mouseY;
      };
    };

    const p5Instance = new p5(sketch, sketchRef.current);
    return () => p5Instance.remove();
  }, [isDarkMode, user]); // Add user to the dependency array

  return <div ref={sketchRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: -1 }}></div>;
};

export default LavaLampBackground;