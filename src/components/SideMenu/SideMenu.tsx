import { VStack, Text, HStack, Skeleton } from '@chakra-ui/react'
import { SidebarHeader } from './SidebarHeader'
import { trpc } from '~/utils/trpc'
import { SIDE_MENU_ITEM_PX } from './sidemenu.constants'
import { BiPencil } from 'react-icons/bi'
import { IconButton, Input, useToast } from '@opengovsg/design-system-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ProfileMenu } from './ProfileMenu'
import router from 'next/router'
import Suspense from '../Suspense'
import { CHAT } from '~/lib/routes'

/** TODO: Allow for chat histories here. Also create a new chat instance every time a user newly visits a page */
export const SideMenu = () => {
  return (
    <VStack
      bgColor="base.content.strong"
      h="100vh"
      overflowY="scroll"
      pt={2}
      px={SIDE_MENU_ITEM_PX}
    >
      <SidebarHeader />
      <VStack w="100%" spacing={4} height="100%" overflowY="scroll">
        <Suspense
          fallback={
            <>
              {[...Array(10)].map((key) => (
                <Skeleton key={key} w="100%" h="40px" />
              ))}
            </>
          }
        >
          <ConversationSuspenseWrapper />
        </Suspense>
      </VStack>
      <ProfileMenu />
    </VStack>
  )
}

const ConversationSuspenseWrapper = () => {
  const [pastConversations] =
    trpc.watson.getPastConversations.useSuspenseQuery()

  return (
    <>
      {Object.entries(pastConversations).map(([bucket, conversations]) => (
        <PastConversationSection
          key={bucket}
          bucket={bucket}
          conversationDetails={conversations}
        />
      ))}
    </>
  )
}

const PastConversationSection = ({
  bucket,
  conversationDetails,
}: {
  bucket: string
  conversationDetails: {
    id: number
    title: string
    latestChatMessageAt: Date
  }[]
}) => {
  const conversationSorted = useMemo(
    () =>
      [...conversationDetails].sort(
        (a, b) =>
          b.latestChatMessageAt.getTime() - a.latestChatMessageAt.getTime(),
      ),
    [conversationDetails],
  )

  return (
    <VStack align="start" w="full" spacing={1}>
      <Text textStyle="caption-1" color="whiteAlpha.500" px={SIDE_MENU_ITEM_PX}>
        {bucket}
      </Text>

      {conversationSorted.map((convo) => (
        <ConversationTitle
          key={convo.id}
          title={convo.title}
          convoId={convo.id}
        />
      ))}
    </VStack>
  )
}

const ConversationTitle = ({
  title,
  convoId,
}: {
  title: string
  convoId: number
}) => {
  const [conversationTitle, setConversationTitle] = useState(title)
  const routerConvoId =
    router.query.id === undefined ? undefined : Number(router.query.id)
  // only needed because we choose to optimistically update
  const [titleBeforeEdit, setTitleBeforeEdit] = useState(title)
  const [isEditMode, setIsEditMode] = useState(false)
  const inputGroupRef = useRef<HTMLInputElement | null>(null)

  const editConversationTitleMutation =
    trpc.watson.updateConversationTitle.useMutation()

  const readOnlyProps = {
    _hover: { bgColor: 'whiteAlpha.200', cursor: 'pointer' },
    _active: { bgColor: 'whiteAlpha.100' },
    onClick: async () => {
      await router.push(`${CHAT}/${convoId}`)
    },
  }

  const toast = useToast({ isClosable: true })

  const handleEditTitle = useCallback(
    async (newTitle: string) => {
      if (newTitle !== titleBeforeEdit) {
        // optimistic update first
        setConversationTitle(newTitle)

        try {
          await editConversationTitleMutation.mutateAsync({
            conversationId: convoId,
            title: newTitle,
          })
        } catch (e) {
          toast({
            status: 'error',
            description:
              'Something went wrong updating conversation title, please try again or contact us for help.',
          })
          setConversationTitle(titleBeforeEdit)
        }

        setTitleBeforeEdit(newTitle)
      }

      setIsEditMode(false)
    },
    [convoId, editConversationTitleMutation, titleBeforeEdit, toast],
  )

  /** This focuses the text within input to the end of the text */
  useEffect(() => {
    if (isEditMode) {
      inputGroupRef.current?.focus()
      inputGroupRef.current?.setSelectionRange(
        conversationTitle.length,
        conversationTitle.length,
      )
    }
  }, [conversationTitle.length, isEditMode])

  return (
    <HStack
      justify="space-between"
      w="full"
      borderRadius={4}
      px={SIDE_MENU_ITEM_PX}
      py={2}
      bgColor={routerConvoId === convoId ? 'whiteAlpha.200' : undefined}
      {...(!isEditMode && readOnlyProps)}
      {...(isEditMode && { bgColor: 'whiteAlpha.400' })}
    >
      {isEditMode ? (
        <Input
          ref={inputGroupRef}
          value={conversationTitle}
          size="xs"
          onBlur={async (e) => {
            await handleEditTitle(e.currentTarget.value)
          }}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              await handleEditTitle(e.currentTarget.value)
            }
          }}
          onChange={(e) => {
            setConversationTitle(e.currentTarget.value)
          }}
          border="0"
          p={0}
          h={'min-content'}
          bgColor="transparent"
          color="white"
          _focusVisible={{ boxShadow: '0px' }}
        />
      ) : (
        <>
          <Text
            color="white"
            textStyle="body-2"
            overflow="hidden"
            whiteSpace={'nowrap'}
            textOverflow="ellipsis"
          >
            {conversationTitle}
          </Text>

          <IconButton
            onClick={() => {
              setIsEditMode(true)
              setTitleBeforeEdit(conversationTitle)
            }}
            aria-label="edit-title"
            size="xs"
            variant="clear"
            py={0}
            minH={'12px'}
            minW="fit-content"
            _hover={{ color: 'white' }}
            icon={<BiPencil size="12px" />}
            color="whiteAlpha.700"
          />
        </>
      )}
    </HStack>
  )
}
