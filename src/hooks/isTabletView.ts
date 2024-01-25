import { useMediaQuery } from '@chakra-ui/react'

export const useIsTabletView = () => {
  const [isSmallerThan900] = useMediaQuery('(max-width: 900px)')

  return isSmallerThan900
}
