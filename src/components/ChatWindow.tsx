interface Message {
  role: string
  content: string
}

interface Props {
  messages: Message[]
}

export default function ChatWindow({ messages }: Props) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto px-12 pt-8 pb-40 flex flex-col gap-12">
      {messages.length > 0 ? (
        messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group relative`}
          >
            <div
              className={`px-4 py-2 rounded-2xl shadow text-base whitespace-pre-line break-words relative ${
                msg.role === "user"
                  ? "bg-blue-500 text-white rounded-br-md"
                  : "bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))
      ) : (
        <div className="text-blue-300 dark:text-blue-800 text-lg text-center mt-32 select-none">
          开始新的对话吧！
        </div>
      )}
    </div>
  )
}
