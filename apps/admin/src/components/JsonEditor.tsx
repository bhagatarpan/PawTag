import Editor from '@monaco-editor/react';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
}

export default function JsonEditor({ value, onChange, height = '400px', readOnly = false }: JsonEditorProps) {
  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <Editor
        height={height}
        defaultLanguage="json"
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val || '')}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          roundedSelection: true,
          scrollBeyondLastLine: false,
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          wordWrap: 'on',
          automaticLayout: true,
          folding: true,
          bracketPairColorization: { enabled: true },
          renderLineHighlight: 'gutter',
          scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  );
}
