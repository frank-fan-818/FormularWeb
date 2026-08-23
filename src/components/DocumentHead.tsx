import { useEffect } from 'react';
import { syncDocumentHead, type DocumentHeadState } from '@/utils/documentHead';

const DocumentHead = (props: DocumentHeadState) => {
  const { title, description, robots } = props;

  useEffect(() => {
    syncDocumentHead({ title, description, robots });
  }, [description, robots, title]);

  return null;
};

export default DocumentHead;
