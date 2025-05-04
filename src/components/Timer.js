import React from 'react';
import { Box, Text, Progress } from '@chakra-ui/react';

const FOUR_HOURS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

function Timer({ environment, startTime, onComplete }) {
  const [timeLeft, setTimeLeft] = React.useState(() => {
    const elapsed = Date.now() - startTime;
    return Math.max(0, FOUR_HOURS - elapsed);
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const newTime = prev - 1000;
        if (newTime <= 0) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [onComplete]);

  // Convert milliseconds to hours, minutes, seconds
  const hours = Math.floor(timeLeft / (60 * 60 * 1000));
  const minutes = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
  const seconds = Math.floor((timeLeft % (60 * 1000)) / 1000);

  // Calculate progress percentage
  const progress = ((FOUR_HOURS - timeLeft) / FOUR_HOURS) * 100;

  return (
    <Box width="100%" p={4} borderRadius="md" bg="gray.50">
      <Text mb={2} fontWeight="bold">
        {environment} - Time Remaining: {hours}h {minutes}m {seconds}s
      </Text>
      <Progress
        value={progress}
        size="sm"
        colorScheme={timeLeft < FOUR_HOURS / 4 ? "red" : "green"}
        borderRadius="full"
      />
    </Box>
  );
}

export default Timer; 