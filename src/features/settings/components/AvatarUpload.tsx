import { Box, Flex, SkeletonCircle } from '@chakra-ui/react'
import { Avatar } from '~/components/Avatar'

interface AvatarUploadProps {
  name?: string | null
  url?: string | null
}

export const AvatarUpload = ({ url, name }: AvatarUploadProps): JSX.Element => {
  return (
    <Box pos="relative">
      <Flex
        as="label"
        transitionProperty="opacity"
        transitionDuration="0.2s"
        zIndex={1}
        position="absolute"
        top={0}
        left={0}
        right={0}
        bottom={0}
        bg="blackAlpha.600"
        borderRadius="full"
        align="center"
        justify="center"
        w="7rem"
        h="7rem"
      ></Flex>
      <SkeletonCircle
        w="7rem"
        h="7rem"
        isLoaded={url !== undefined}
        pos="relative"
      >
        <Avatar
          src={url}
          name={name}
          size="2xl"
          w="7rem"
          h="7rem"
          variant="subtle"
          bg="base.canvas.brand-subtle"
          aria-label="profile picture"
        />
      </SkeletonCircle>
    </Box>
  )
}
