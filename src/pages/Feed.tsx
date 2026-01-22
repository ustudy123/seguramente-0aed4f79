import { motion } from "framer-motion";
import { MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostForm } from "@/components/feed/PostForm";
import { PostCard } from "@/components/feed/PostCard";
import { AniversariantesWidget } from "@/components/feed/AniversariantesWidget";
import { TempoEmpresaWidget } from "@/components/feed/TempoEmpresaWidget";
import { useFeed } from "@/hooks/useFeed";

function FeedSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
          <Skeleton className="h-16 w-full" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-8 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center py-12"
    >
      <div className="inline-flex p-4 rounded-2xl bg-primary/10 mb-4">
        <MessageSquare className="w-10 h-10 text-primary" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Nenhuma publicação ainda</h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Seja o primeiro a compartilhar algo com a equipe! Use o formulário acima
        para criar sua primeira publicação.
      </p>
    </motion.div>
  );
}

export default function Feed() {
  const { posts, isLoading, refetch } = useFeed();

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">Feed Social</h1>
          <p className="text-muted-foreground">
            Conecte-se e compartilhe com sua equipe
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna principal - Feed */}
        <div className="lg:col-span-2">
          <PostForm />

          {isLoading ? (
            <FeedSkeleton />
          ) : posts.length === 0 ? (
            <EmptyState />
          ) : (
            <div>
              {posts.map((post) => (
                <PostCard key={post.id} post={post} />
              ))}
            </div>
          )}
        </div>

        {/* Sidebar - Widgets */}
        <div className="space-y-4">
          <AniversariantesWidget />
          <TempoEmpresaWidget />
        </div>
      </div>
    </div>
  );
}
