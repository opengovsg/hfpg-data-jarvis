import {
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  Skeleton,
  Tooltip,
  useDisclosure,
} from '@chakra-ui/react'
import { IconButton, Spinner, useToast } from '@opengovsg/design-system-react'
import Image from 'next/image'
import { useState } from 'react'
import { BiLineChart } from 'react-icons/bi'
import { GiMining } from 'react-icons/gi'
import { trpc } from '~/utils/trpc'
import Suspense from './Suspense'
import { ErrorBoundary } from 'react-error-boundary'
import { DefaultFallback } from './ErrorBoundary'

// TODO: Rethink UX if this becomes a real thing
export const GenerateChartButton = ({
  messageId,
}: {
  messageId: number
}): JSX.Element => {
  const utils = trpc.useUtils()

  // TODO: Make this async call with polling if this becomes a prod app, now we have race conditions
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false)

  const { isOpen, onClose, onOpen } = useDisclosure()

  const [{ s3ObjectKey }] =
    trpc.watson.getGraphs3ObjectKeyByMessageId.useSuspenseQuery({ messageId })

  const generateGraphMutation = trpc.watson.generateGraph.useMutation()

  const toast = useToast({ isClosable: true })

  if (isGeneratingGraph) {
    return <Spinner />
  }

  if (!s3ObjectKey) {
    return (
      <Tooltip label="Visualise data">
        <IconButton
          color={'gray.500'}
          variant="link"
          p={1}
          minH={'14px'}
          minW="fit-content"
          icon={<GiMining size="14px" />}
          aria-label="generate-chart"
          onClick={async () => {
            setIsGeneratingGraph(true)

            try {
              await generateGraphMutation.mutateAsync({ messageId })
              await utils.watson.getGraphs3ObjectKeyByMessageId.invalidate()
            } catch (e) {
              toast({
                status: 'error',
                description:
                  'Failed to generate graph, please try again or contact us for help!',
              })
            }
            setIsGeneratingGraph(false)
          }}
        >
          Start
        </IconButton>
      </Tooltip>
    )
  }

  return (
    <>
      <Tooltip label="View Generated Chart">
        <IconButton
          // TODO: Set a style for this to be shared across all iconbuttons
          color={'gray.500'}
          variant="link"
          p={1}
          minH={'14px'}
          minW="fit-content"
          icon={<BiLineChart size="14px" />}
          aria-label="view-chart"
          onClick={onOpen}
        />
      </Tooltip>

      {isOpen && (
        <ViewChartModal
          isOpen={isOpen}
          onClose={onClose}
          messageId={messageId}
        />
      )}
    </>
  )
}

const ViewChartModal = ({
  isOpen,
  onClose,
  messageId,
}: {
  isOpen: boolean
  messageId: number
  onClose: () => void
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalHeader>Chart</ModalHeader>
        <ModalBody>
          <ErrorBoundary FallbackComponent={DefaultFallback}>
            <Suspense fallback={<Skeleton width="500px" height="500px" />}>
              <ChartDisplay messageId={messageId} />
            </Suspense>
          </ErrorBoundary>
        </ModalBody>
        <ModalFooter></ModalFooter>
      </ModalContent>
    </Modal>
  )
}

const ChartDisplay = ({ messageId }: { messageId: number }) => {
  const [presignedUrl] = trpc.watson.getGraphPresignedUrl.useSuspenseQuery({
    messageId,
  })

  return <Image src={presignedUrl} alt="graph" width={500} height={500} />
}
