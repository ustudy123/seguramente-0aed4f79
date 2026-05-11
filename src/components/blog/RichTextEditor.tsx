import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import Typography from '@tiptap/extension-typography';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Bold, Italic, Underline as UIcon, Strikethrough, Code, Quote,
  Heading1, Heading2, Heading3, List, ListOrdered,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Link as LinkIcon, Image as ImageIcon, Youtube as YTIcon,
  Undo2, Redo2, Minus, Video as VideoIcon,
} from 'lucide-react';
import { useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const BUCKET = 'blog-media';

async function uploadToBucket(file: File): Promise<string | null> {
  const ext = file.name.split('.').pop();
  const path = `posts/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (error) {
    toast.error('Erro no upload: ' + error.message);
    return null;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function ToolbarBtn({
  onClick, active, disabled, children, title,
}: { onClick: () => void; active?: boolean; disabled?: boolean; children: React.ReactNode; title: string }) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="sm"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-8 w-8 p-0"
    >
      {children}
    </Button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const imgInput = useRef<HTMLInputElement>(null);
  const vidInput = useRef<HTMLInputElement>(null);

  const handleImage = async (file: File) => {
    const url = await uploadToBucket(file);
    if (url) editor.chain().focus().setImage({ src: url, alt: file.name }).run();
  };

  const handleVideo = async (file: File) => {
    const url = await uploadToBucket(file);
    if (url) {
      editor.chain().focus().insertContent(
        `<video controls src="${url}" style="max-width:100%;border-radius:8px;margin:1rem 0"></video><p></p>`
      ).run();
    }
  };

  const setLink = () => {
    const prev = editor.getAttributes('link').href;
    const url = window.prompt('URL do link:', prev || 'https://');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank' }).run();
  };

  const addYoutube = () => {
    const url = window.prompt('URL do YouTube:');
    if (url) editor.commands.setYoutubeVideo({ src: url, width: 640, height: 360 });
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/30 p-2 sticky top-0 z-10">
      <ToolbarBtn title="Desfazer" onClick={() => editor.chain().focus().undo().run()}><Undo2 className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Refazer" onClick={() => editor.chain().focus().redo().run()}><Redo2 className="h-4 w-4" /></ToolbarBtn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn title="H1" active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}><Heading3 className="h-4 w-4" /></ToolbarBtn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn title="Negrito" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Itálico" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}><UIcon className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Riscado" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Código" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="h-4 w-4" /></ToolbarBtn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn title="Lista" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Citação" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Linha horizontal" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="h-4 w-4" /></ToolbarBtn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn title="Alinhar à esquerda" active={editor.isActive({ textAlign: 'left' })} onClick={() => editor.chain().focus().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Centralizar" active={editor.isActive({ textAlign: 'center' })} onClick={() => editor.chain().focus().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Alinhar à direita" active={editor.isActive({ textAlign: 'right' })} onClick={() => editor.chain().focus().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Justificar" active={editor.isActive({ textAlign: 'justify' })} onClick={() => editor.chain().focus().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></ToolbarBtn>
      <Separator orientation="vertical" className="h-6 mx-1" />
      <ToolbarBtn title="Link" active={editor.isActive('link')} onClick={setLink}><LinkIcon className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Imagem" onClick={() => imgInput.current?.click()}><ImageIcon className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="Vídeo (upload)" onClick={() => vidInput.current?.click()}><VideoIcon className="h-4 w-4" /></ToolbarBtn>
      <ToolbarBtn title="YouTube" onClick={addYoutube}><YTIcon className="h-4 w-4" /></ToolbarBtn>

      <input ref={imgInput} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); e.target.value = ''; }} />
      <input ref={vidInput} type="file" accept="video/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideo(f); e.target.value = ''; }} />
    </div>
  );
}

export function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Underline,
      Typography,
      Placeholder.configure({ placeholder: placeholder || 'Comece a escrever seu artigo...' }),
      Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { class: 'text-primary underline' } }),
      Image.configure({ HTMLAttributes: { class: 'rounded-lg my-4 max-w-full mx-auto' } }),
      Youtube.configure({ controls: true, nocookie: true, HTMLAttributes: { class: 'rounded-lg my-4 mx-auto' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-6 py-4',
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
