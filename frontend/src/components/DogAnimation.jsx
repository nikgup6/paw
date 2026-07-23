import React from 'react';

const DogAnimation = () => {
  return (
    <div style={{
      position: 'absolute',
      bottom: '0',
      left: '0',
      width: '100%',
      height: '150px',
      overflow: 'hidden',
      pointerEvents: 'none',
      zIndex: 10
    }}>
      <style>
        {`
          @keyframes runRight {
            0% { transform: translateX(-150px) scaleX(1); }
            45% { transform: translateX(110vw) scaleX(1); }
            50% { transform: translateX(110vw) scaleX(-1); }
            95% { transform: translateX(-150px) scaleX(-1); }
            100% { transform: translateX(-150px) scaleX(1); }
          }
          @keyframes bounceBall {
            0% { transform: translateY(0) rotate(0deg); }
            15% { transform: translateY(-80px) rotate(90deg); }
            30% { transform: translateY(0) rotate(180deg); }
            45% { transform: translateY(-50px) rotate(270deg); }
            60% { transform: translateY(0) rotate(360deg); }
            75% { transform: translateY(-20px) rotate(450deg); }
            90% { transform: translateY(0) rotate(540deg); }
            100% { transform: translateY(0) rotate(720deg); }
          }
          @keyframes ballMove {
            0% { transform: translateX(-50px); }
            45% { transform: translateX(110vw); opacity: 1; }
            46% { opacity: 0; }
            95% { transform: translateX(-50px); opacity: 0; }
            96% { opacity: 1; }
            100% { transform: translateX(-50px); opacity: 1; }
          }
          @keyframes runCycle {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            25% { transform: translateY(-5px) rotate(-2deg); }
            50% { transform: translateY(0) rotate(0deg); }
            75% { transform: translateY(-3px) rotate(2deg); }
          }
          .dog-wrapper {
            position: absolute;
            bottom: 20px;
            left: 0;
            animation: runRight 10s linear infinite;
          }
          .dog-svg {
            width: 100px;
            height: auto;
            fill: var(--orange);
            animation: runCycle 0.4s infinite linear;
          }
          .ball-wrapper {
            position: absolute;
            bottom: 25px;
            left: 120px;
            animation: ballMove 10s linear infinite;
          }
          .ball-svg {
            width: 25px;
            height: 25px;
            fill: #8bc34a;
            animation: bounceBall 2.5s ease-out infinite;
          }
        `}
      </style>
      
      <div className="ball-wrapper">
        <svg className="ball-svg" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="#aeea00" />
          <path d="M 20 20 Q 50 80 80 80" stroke="#fff" strokeWidth="6" fill="none" />
          <path d="M 80 20 Q 50 80 20 80" stroke="#fff" strokeWidth="6" fill="none" />
        </svg>
      </div>

      <div className="dog-wrapper">
        <svg className="dog-svg" viewBox="0 0 512 512">
          <path d="M480 224h-55.7c-21.7-41.9-59-71.5-104.3-80V96c0-17.7-14.3-32-32-32s-32 14.3-32 32v24.6C239 123 224.2 128 210.4 135L152 76.6c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L166 181.3C139.7 207 128 243.6 128 281.6V352c0 23.9 14.3 44.5 35 52.8V448c0 17.7 14.3 32 32 32s32-14.3 32-32v-32h80v32c0 17.7 14.3 32 32 32s32-14.3 32-32v-44.5c21.8-8.5 37-29.8 37-54.3v-58.4c48.1-15.1 84-58 84-111.3V256c0-17.7-14.3-32-32-32zm-224 80c-17.7 0-32-14.3-32-32s14.3-32 32-32 32 14.3 32 32-14.3 32-32 32z" />
          <path d="M64 288c-17.7 0-32 14.3-32 32v64c0 17.7 14.3 32 32 32s32-14.3 32-32v-64c0-17.7-14.3-32-32-32z" />
        </svg>
      </div>

    </div>
  );
};

export default DogAnimation;
