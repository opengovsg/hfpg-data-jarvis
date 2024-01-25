import {
  Box,
  Grid,
  IconButton,
  InputGroup,
  Text,
  VStack,
  Textarea,
  Skeleton,
  HStack,
  SkeletonCircle,
} from '@chakra-ui/react'
import { BiSend } from 'react-icons/bi'
import { WatsonHeader } from '~/components/ChatWindow/WatsonHeader'

/** TODO: Change ChatWindowSkeleton and ChatWindow into a `ChatWindowLayout` to keep styles in sync */
export const ChatWindowSkeleton = () => {
  return (
    <Grid
      gridTemplateRows={`min-content 1fr min-content`}
      h="100%"
      w="100%"
      bgColor="base.canvas.brand-subtle"
      overflowY="hidden"
    >
      <WatsonHeader />
      <VStack spacing={6} mt={6} overflowY="scroll" px={8}>
        {[...Array(6)].map((key) => (
          <HStack key={key} w="100%" spacing={4} maxH="56px">
            <SkeletonCircle size="50px" />
            <Skeleton h="56px" flex={1} />
          </HStack>
        ))}
      </VStack>
      <VStack mb={4} px={8}>
        <Box
          border="1px solid"
          borderColor="gray.400"
          p={1.5}
          borderRadius="8px"
          w="100%"
        >
          <InputGroup alignItems="center">
            <Textarea
              bgColor="transparent"
              minH="unset"
              border="0px"
              _focusVisible={{ boxShadow: '0px' }}
              overflow="hidden"
              resize="none"
              overflowY="scroll"
              value=""
              rows={1}
              isDisabled={true}
            />
            <IconButton
              variant="clear"
              isDisabled={true}
              type="submit"
              icon={<BiSend />}
              aria-label={'send-jarvis'}
            />
          </InputGroup>
        </Box>

        <Text textStyle="caption-2">
          Watson can make mistakes. Please use the information presented as a
          reference for guidance only.
        </Text>
      </VStack>
    </Grid>
  )
}
