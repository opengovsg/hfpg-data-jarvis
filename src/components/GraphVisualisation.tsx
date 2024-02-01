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
  VStack,
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
import { Prose } from '@nikolovlazar/chakra-ui-prose'

// TODO: Rethink UX if this becomes a real thing
export const GenerateChartButton = ({
  messageId,
  question,
}: {
  messageId: number
  question: string
}): JSX.Element => {
  const utils = trpc.useUtils()

  // TODO: Make this async call with polling if this becomes a prod app, now we have race conditions
  const [isGeneratingGraph, setIsGeneratingGraph] = useState(false)

  const { isOpen, onClose, onOpen } = useDisclosure()

  const [{ s3ObjectKey }] =
    trpc.watson.getGraphs3ObjectKeyByMessageId.useSuspenseQuery({ messageId })

  const generateGraphMutation = trpc.watson.generateGraph.useMutation({
    retry: false,
  })

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
      <Tooltip label="View generated visualisation">
        <IconButton
          // TODO: Set a style for this to be shared across all iconbuttons
          color={'gray.500'}
          variant="link"
          p={1}
          minH={'14px'}
          minW="fit-content"
          icon={<BiLineChart size="14px" />}
          aria-label="view-visualisation"
          onClick={onOpen}
        />
      </Tooltip>

      {isOpen && (
        <ViewChartModal
          question={question}
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
  question,
}: {
  isOpen: boolean
  messageId: number
  question: string
  onClose: () => void
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <ModalOverlay />
      <ModalContent>
        <ModalCloseButton />
        <ModalHeader>Generated visualisation</ModalHeader>
        <ModalBody>
          <VStack w="full" align="start">
            <Prose>
              <blockquote style={{ margin: 0 }}>{question}</blockquote>
            </Prose>
            <ErrorBoundary FallbackComponent={DefaultFallback}>
              <Suspense fallback={<Skeleton width="500px" height="500px" />}>
                <ChartDisplay messageId={messageId} />
              </Suspense>
            </ErrorBoundary>
          </VStack>
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

  return <Image src={presignedUrl} alt="graph" width={700} height={700} />
}
