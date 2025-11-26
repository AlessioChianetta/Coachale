import { useState } from 'react';
import { Plus, Trash2, AlertCircle, Star, Bell } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { BlockContainer } from './BlockContainer';
import type { GlobalRule } from '@shared/script-blocks';

interface BlockGlobalRuleProps {
  rule: GlobalRule;
  onUpdate?: (rule: GlobalRule) => void;
  readOnly?: boolean;
}

const RULE_TYPES = [
  { value: 'critical', label: 'Critica', icon: AlertCircle, color: 'text-red-600' },
  { value: 'golden', label: 'Regola d\'Oro', icon: Star, color: 'text-yellow-600' },
  { value: 'reminder', label: 'Promemoria', icon: Bell, color: 'text-blue-600' },
] as const;

export function BlockGlobalRule({ rule, onUpdate, readOnly = false }: BlockGlobalRuleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedRule, setEditedRule] = useState<GlobalRule>(rule);

  const handleEdit = () => {
    setEditedRule(rule);
    setIsEditing(true);
  };

  const handleSave = () => {
    onUpdate?.(editedRule);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedRule(rule);
    setIsEditing(false);
  };

  const addItem = () => {
    setEditedRule({
      ...editedRule,
      items: [...(editedRule.items || []), ''],
    });
  };

  const removeItem = (index: number) => {
    const newItems = [...(editedRule.items || [])];
    newItems.splice(index, 1);
    setEditedRule({ ...editedRule, items: newItems });
  };

  const updateItem = (index: number, value: string) => {
    const newItems = [...(editedRule.items || [])];
    newItems[index] = value;
    setEditedRule({ ...editedRule, items: newItems });
  };

  const displayRule = isEditing ? editedRule : rule;

  const ruleType = RULE_TYPES.find(t => t.value === displayRule.type) || RULE_TYPES[0];
  const RuleIcon = ruleType.icon;

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'golden':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'reminder':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default:
        return '';
    }
  };

  return (
    <BlockContainer
      type="globalRule"
      title={displayRule.title}
      isEditing={isEditing}
      onEdit={readOnly ? undefined : handleEdit}
      onSave={handleSave}
      onCancel={handleCancel}
      headerExtra={
        <Badge className={getTypeBadgeColor(displayRule.type)}>
          <RuleIcon className="h-3 w-3 mr-1" />
          {ruleType.label}
        </Badge>
      }
    >
      <div className="space-y-4">
        {isEditing ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rule-type">Tipo</Label>
                <Select
                  value={editedRule.type}
                  onValueChange={(value: 'critical' | 'golden' | 'reminder') => 
                    setEditedRule({ ...editedRule, type: value })
                  }
                >
                  <SelectTrigger id="rule-type">
                    <SelectValue placeholder="Seleziona tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {RULE_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className={`h-4 w-4 ${type.color}`} />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rule-title">Titolo</Label>
                <Input
                  id="rule-title"
                  value={editedRule.title}
                  onChange={(e) => setEditedRule({ ...editedRule, title: e.target.value })}
                  placeholder="Titolo della regola..."
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-content">Contenuto</Label>
              <Textarea
                id="rule-content"
                value={editedRule.content}
                onChange={(e) => setEditedRule({ ...editedRule, content: e.target.value })}
                placeholder="Descrizione della regola..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Elementi (opzionale)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
              </div>
              <div className="space-y-2">
                {(editedRule.items || []).map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={item}
                      onChange={(e) => updateItem(index, e.target.value)}
                      placeholder="Elemento della lista..."
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm">{displayRule.content}</p>
            
            {displayRule.items && displayRule.items.length > 0 && (
              <div className="mt-3">
                <ul className="list-disc list-inside text-sm space-y-1">
                  {displayRule.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </BlockContainer>
  );
}
