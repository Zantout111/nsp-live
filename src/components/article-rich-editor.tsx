'use client';

import {
  MDXEditor,
  type MDXEditorMethods,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  linkPlugin,
  linkDialogPlugin,
  markdownShortcutPlugin,
  toolbarPlugin,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  ListsToggle,
  Separator,
  UndoRedo,
  imagePlugin,
} from '@mdxeditor/editor';
import { useRef } from 'react';

type Props = {
  markdown: string;
  onChange: (value: string) => void;
  onUploadImage?: (file: File) => Promise<string>;
};

/**
 * محرر بصري (بدون إظهار #) مع دعم H1..H4 وفق Markdown.
 * اختيار "Paragraph" من BlockTypeSelect = إلغاء العنونة.
 */
export function ArticleRichEditor({ markdown, onChange, onUploadImage }: Props) {
  const ref = useRef<MDXEditorMethods | null>(null);
  return (
    <div className="rounded-md border border-input bg-background p-2 dark:border-slate-600 dark:bg-slate-900/80">
      <MDXEditor
        ref={ref}
        markdown={markdown}
        onChange={onChange}
        contentEditableClassName="prose prose-slate max-w-none min-h-[360px] px-2 py-2 dark:prose-invert prose-headings:font-bold"
        plugins={[
          headingsPlugin({ allowedHeadingLevels: [1, 2, 3, 4] }),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          markdownShortcutPlugin(),
          imagePlugin(
            onUploadImage
              ? {
                  imageUploadHandler: onUploadImage,
                }
              : {}
          ),
          toolbarPlugin({
            toolbarClassName:
              'article-editor-toolbar flex flex-nowrap items-center gap-1 overflow-x-auto whitespace-nowrap rounded-md border border-border/70 bg-muted/40 p-1 scrollbar-thin',
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BlockTypeSelect />
                <BoldItalicUnderlineToggles />
                <ListsToggle />
                <CreateLink />
                <InsertImage />
              </>
            ),
          }),
        ]}
      />
    </div>
  );
}

