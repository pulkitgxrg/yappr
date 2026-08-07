import Chat from "../../components/Chat";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = await params;
  return <Chat videoId={videoId} />;
}
