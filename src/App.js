import React from 'react';
import { ChakraProvider, Box, VStack, Button, Text, useToast } from '@chakra-ui/react';
import Timer from './components/Timer';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [activeTimers, setActiveTimers] = React.useState(() => {
    // Load timers from localStorage on initial render
    const savedTimers = localStorage.getItem('activeTimers');
    if (savedTimers) {
      const parsedTimers = JSON.parse(savedTimers);
      // Filter out expired timers
      const now = Date.now();
      return Object.entries(parsedTimers).reduce((acc, [env, startTime]) => {
        const elapsed = now - startTime;
        if (elapsed < 4 * 60 * 60 * 1000) { // 4 hours in milliseconds
          acc[env] = startTime;
        }
        return acc;
      }, {});
    }
    return {};
  });

  const toast = useToast();

  // Save timers to localStorage whenever they change
  React.useEffect(() => {
    localStorage.setItem('activeTimers', JSON.stringify(activeTimers));
  }, [activeTimers]);

  const handleCommandClick = async (env) => {
    try {
      const response = await fetch(`${API_URL}/execute-command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ env }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute command');
      }

      // Add or update timer for this environment
      setActiveTimers(prev => ({
        ...prev,
        [env]: Date.now() // Store the start time
      }));
      
      toast({
        title: 'Command Executed',
        description: `Started "kaft env ${env}" with a 4-hour timer`,
        status: 'success',
        duration: 5000,
        isClosable: true,
      });
    } catch (error) {
      console.error('Error:', error);
      toast({
        title: 'Command Failed',
        description: error.message,
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const handleTimerComplete = (env) => {
    setActiveTimers(prev => {
      const newTimers = { ...prev };
      delete newTimers[env];
      return newTimers;
    });
  };

  return (
    <ChakraProvider>
      <Box minH="100vh" bg="gray.100" py={10}>
        <VStack spacing={6} maxW="container.sm" mx="auto" p={6} bg="white" borderRadius="lg" boxShadow="md">
          <Text fontSize="2xl" fontWeight="bold" mb={4}>
            CLI Command Interface
          </Text>
          
          <VStack spacing={4} width="100%">
            <Button
              colorScheme="teal"
              width="100%"
              size="lg"
              onClick={() => handleCommandClick('localdev')}
              isDisabled={!!activeTimers['localdev']}
            >
              kaft env localdev
            </Button>
            
            <Button
              colorScheme="purple"
              width="100%"
              size="lg"
              onClick={() => handleCommandClick('master')}
              isDisabled={!!activeTimers['master']}
            >
              kaft env master
            </Button>
          </VStack>

          {Object.entries(activeTimers).map(([env, startTime]) => (
            <Timer
              key={env}
              environment={env}
              startTime={startTime}
              onComplete={() => handleTimerComplete(env)}
            />
          ))}
        </VStack>
      </Box>
    </ChakraProvider>
  );
}

export default App; 